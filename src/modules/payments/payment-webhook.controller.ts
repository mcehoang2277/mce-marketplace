import { Request, Response } from 'express';
import { LedgerAccountType, LedgerEntrySide, Prisma } from '@prisma/client';
import { ENV } from '../../config/env';
import { prisma } from '../../core/database/prisma';
import { LedgerService } from '../ledger/ledger.service';
import { verifySePaySignature } from './sepay-signature';

type SePayPayload = {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  content: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  referenceCode?: string | null;
};

/**
 * Verified bank events are never silently discarded. Matched deposits fund escrow;
 * unmatched or mismatched incoming deposits are journaled to SUSPENSE for operations.
 */
export class PaymentWebhookController {
  public static async handleBankWebhook(req: Request, res: Response) {
    const secret = ENV.SEPAY_WEBHOOK_SECRET;
    if (!secret || secret.length < 32) {
      return res.status(503).json({ success: false, message: 'SePay HMAC chưa được cấu hình.' });
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.header('X-SePay-Signature') || '';
    const timestampHeader = req.header('X-SePay-Timestamp') || '';
    if (!rawBody || !/^sha256=[a-f0-9]{64}$/i.test(signature) || !/^\d{10}$/.test(timestampHeader)) {
      return res.status(401).json({ success: false, message: 'Thiếu chữ ký hoặc raw body hợp lệ.' });
    }
    if (!verifySePaySignature(secret, timestampHeader, signature, rawBody)) {
      return res.status(401).json({ success: false, message: 'Chữ ký SePay không hợp lệ hoặc webhook đã quá hạn.' });
    }

    let payload: SePayPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as SePayPayload;
    } catch {
      return res.status(400).json({ success: false, message: 'Payload JSON không hợp lệ.' });
    }
    if (
      !Number.isSafeInteger(payload.id) || payload.id <= 0 ||
      typeof payload.accountNumber !== 'string' ||
      typeof payload.content !== 'string' ||
      !Number.isSafeInteger(payload.transferAmount) || payload.transferAmount <= 0 ||
      !['in', 'out'].includes(payload.transferType)
    ) {
      return res.status(400).json({ success: false, message: 'Thiếu trường giao dịch bắt buộc.' });
    }

    const normalizeAccount = (value: string) => value.replace(/\D/g, '');
    if (!ENV.VIETQR_ACCOUNT_NO || normalizeAccount(payload.accountNumber) !== normalizeAccount(ENV.VIETQR_ACCOUNT_NO)) {
      return res.status(400).json({ success: false, message: 'Giao dịch không thuộc tài khoản nhận tiền đã cấu hình.' });
    }

    const idempotencyKey = `SEPAY:${payload.id}`;
    try {
      await prisma.$transaction(async (tx) => {
        const event = await tx.webhookEvent.create({
          data: {
            provider: 'SEPAY',
            eventType: payload.transferType === 'in' ? 'BANK_TRANSFER_IN' : 'BANK_TRANSFER_OUT',
            idempotencyKey,
            signature,
            payload: rawBody.toString('utf8'),
            isVerified: true
          }
        });

        if (payload.transferType !== 'in') {
          await tx.webhookEvent.update({
            where: { id: event.id },
            data: { isProcessed: true, processedAt: new Date(), errorMessage: 'Giao dịch chiều ra được ghi nhận; không tự động thay đổi số dư.' }
          });
          return;
        }

        const amount = new Prisma.Decimal(payload.transferAmount);
        const referenceMatch = payload.content.match(/MCE[A-F0-9]{12}/i);
        const payment = referenceMatch
          ? await tx.paymentTransaction.findUnique({
              where: { referenceCode: referenceMatch[0].toUpperCase() },
              include: { job: true }
            })
          : null;

        const suspendIncoming = async (reason: string) => {
          await LedgerService.createPosting(tx, {
            eventType: 'BANK_IN_SUSPENSE',
            idempotencyKey: `BANK_SUSPENSE:${payload.id}`,
            referenceType: 'SEPAY_TRANSACTION',
            referenceId: String(payload.id),
            description: reason,
            lines: [
              { accountCode: 'BANK_CLEARING', accountName: 'Bank clearing asset', accountType: LedgerAccountType.ASSET, side: LedgerEntrySide.DEBIT, amount },
              { accountCode: 'SUSPENSE', accountName: 'Unmatched incoming bank funds', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.CREDIT, amount }
            ]
          });
          await tx.webhookEvent.update({
            where: { id: event.id },
            data: { isProcessed: true, processedAt: new Date(), errorMessage: reason }
          });
        };

        if (!payment || payment.status !== 'PENDING' || !payment.job) {
          await suspendIncoming('Tiền đã vào tài khoản nhưng không có yêu cầu thanh toán đang chờ; cần đối soát SUSPENSE.');
          return;
        }

        // Serialize all funding/escrow state changes for this job.
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Job" WHERE "id" = ${payment.job.id} FOR UPDATE`;
        const job = await tx.job.findUnique({ where: { id: payment.job.id } });
        if (
          !job ||
          !payment.amount.equals(amount) ||
          job.posterId !== payment.userId ||
          job.status !== 'DRAFT' ||
          !job.totalEstimatedVnd.equals(amount)
        ) {
          await suspendIncoming('Tiền đã vào nhưng mã, số tiền, chủ công việc hoặc trạng thái không khớp; đã ghi SUSPENSE để đối soát.');
          return;
        }

        const wallet = await tx.wallet.upsert({
          where: { userId: payment.userId },
          create: {
            userId: payment.userId,
            availableBalance: new Prisma.Decimal(0),
            lockedBalance: new Prisma.Decimal(0),
            totalDeposited: new Prisma.Decimal(0),
            totalWithdrawn: new Prisma.Decimal(0)
          },
          update: {}
        });
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Wallet" WHERE "id" = ${wallet.id} FOR UPDATE`;

        const paymentChanged = await tx.paymentTransaction.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: { status: 'SUCCESS', paidAt: new Date(), rawResponse: rawBody.toString('utf8') }
        });
        const jobChanged = await tx.job.updateMany({
          where: { id: job.id, status: 'DRAFT', posterId: payment.userId },
          data: { status: 'OPEN' }
        });
        if (paymentChanged.count !== 1 || jobChanged.count !== 1) {
          throw new Error('Payment or job state changed during bank reconciliation.');
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { lockedBalance: { increment: amount }, totalDeposited: { increment: amount } }
        });

        await LedgerService.createPosting(tx, {
          eventType: 'BANK_IN',
          idempotencyKey: `BANK_IN:${payload.id}`,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
          description: `SePay xác nhận tiền vào cho yêu cầu ${payment.referenceCode}`,
          lines: [
            { accountCode: 'BANK_CLEARING', accountName: 'Bank clearing asset', accountType: LedgerAccountType.ASSET, side: LedgerEntrySide.DEBIT, amount },
            { accountCode: `USER_AVAILABLE:${payment.userId}`, accountName: 'User available wallet liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.CREDIT, amount }
          ]
        });
        await LedgerService.createPosting(tx, {
          eventType: 'ESCROW_LOCK',
          idempotencyKey: `ESCROW_LOCK:${job.id}`,
          referenceType: 'JOB',
          referenceId: job.id,
          description: `Khóa ký quỹ cho công việc ${job.title}; phí sàn 0%`,
          lines: [
            { accountCode: `USER_AVAILABLE:${payment.userId}`, accountName: 'User available wallet liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.DEBIT, amount },
            { accountCode: `ESCROW_JOB:${job.id}`, accountName: 'Job escrow liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.CREDIT, amount }
          ]
        });

        const availableBefore = wallet.availableBalance;
        const availableAfterTopup = availableBefore.plus(amount);
        await tx.walletTransaction.createMany({
          data: [
            {
              walletId: wallet.id, type: 'TOPUP', amount, balanceBefore: availableBefore,
              balanceAfter: availableAfterTopup, referenceId: `PAYMENT:${payment.id}`,
              description: `SePay xác nhận tiền vào cho yêu cầu ${payment.referenceCode}`
            },
            {
              walletId: wallet.id, type: 'ESCROW_LOCK', amount, balanceBefore: availableAfterTopup,
              balanceAfter: availableBefore, referenceId: job.id,
              description: `Khóa ký quỹ tự động cho công việc: ${job.title}`
            }
          ]
        });
        await tx.escrowTransaction.create({
          data: {
            jobId: job.id, grossAmount: amount, platformFeeRate: 0,
            platformFeeVnd: new Prisma.Decimal(0), netWorkerPayout: amount,
            status: 'LOCKED', lockedAt: new Date()
          }
        });
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: { isProcessed: true, processedAt: new Date() }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return res.status(200).json({ success: true });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        try {
          const existingEvent = await prisma.webhookEvent.findUnique({ where: { idempotencyKey }, select: { id: true } });
          if (existingEvent) return res.status(200).json({ success: true, duplicate: true });
        } catch {
          // The provider must retry if duplicate status cannot be confirmed.
        }
      }
      return res.status(500).json({ success: false, message: 'Không thể ghi nhận giao dịch; SePay có thể gửi lại.' });
    }
  }

  public static async simulateWebhook(_req: Request, res: Response) {
    return res.status(503).json({
      success: false,
      status: 'PAYMENT_SIMULATION_DISABLED',
      message: 'Không hỗ trợ giả lập thanh toán trên môi trường ứng dụng.'
    });
  }
}
