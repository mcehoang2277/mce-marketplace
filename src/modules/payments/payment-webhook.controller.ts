import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ENV } from '../../config/env';
import { prisma } from '../../core/database/prisma';

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
 * SePay HMAC-SHA256 IPN handler.
 * Uses exact raw bytes + timestamp, then reconciles receiving account, transfer
 * direction, payment reference, exact amount and a unique provider transaction ID.
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

    const timestamp = Number(timestampHeader);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
      return res.status(401).json({ success: false, message: 'Webhook đã quá hạn hoặc timestamp không hợp lệ.' });
    }

    const expected = `sha256=${createHmac('sha256', secret).update(`${timestampHeader}.`).update(rawBody).digest('hex')}`;
    const expectedBytes = Buffer.from(expected, 'utf8');
    const suppliedBytes = Buffer.from(signature, 'utf8');
    if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
      return res.status(401).json({ success: false, message: 'Chữ ký SePay không hợp lệ.' });
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
          await tx.webhookEvent.update({ where: { id: event.id }, data: { isProcessed: true, processedAt: new Date() } });
          return;
        }

        const referenceMatch = payload.content.match(/MCE[A-F0-9]{12}/i);
        if (!referenceMatch) {
          await tx.webhookEvent.update({
            where: { id: event.id },
            data: { errorMessage: 'Không tìm thấy mã thanh toán MCE trong nội dung chuyển khoản.' }
          });
          return;
        }

        const payment = await tx.paymentTransaction.findUnique({
          where: { referenceCode: referenceMatch[0].toUpperCase() },
          include: { job: true }
        });
        if (!payment || payment.status !== 'PENDING' || !payment.job) {
          await tx.webhookEvent.update({
            where: { id: event.id },
            data: { errorMessage: 'Không tìm thấy yêu cầu thanh toán đang chờ tương ứng.' }
          });
          return;
        }

        const amount = new Prisma.Decimal(payload.transferAmount);
        if (
          !payment.amount.equals(amount) ||
          payment.job.posterId !== payment.userId ||
          payment.job.status !== 'DRAFT' ||
          !payment.job.totalEstimatedVnd.equals(amount)
        ) {
          await tx.webhookEvent.update({
            where: { id: event.id },
            data: { errorMessage: 'Sai số tiền, chủ công việc hoặc trạng thái công việc; cần đối soát thủ công.' }
          });
          return;
        }

        let wallet = await tx.wallet.findUnique({ where: { userId: payment.userId } });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              userId: payment.userId,
              availableBalance: new Prisma.Decimal(0),
              lockedBalance: new Prisma.Decimal(0),
              totalDeposited: new Prisma.Decimal(0),
              totalWithdrawn: new Prisma.Decimal(0)
            }
          });
        }

        const balanceBefore = wallet.availableBalance;
        const balanceAfterTopup = balanceBefore.plus(amount);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            lockedBalance: { increment: amount },
            totalDeposited: { increment: amount }
          }
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'TOPUP',
            amount,
            balanceBefore,
            balanceAfter: balanceAfterTopup,
            referenceId: `PAYMENT:${payment.id}`,
            description: `SePay xác nhận tiền vào cho yêu cầu ${payment.referenceCode}`
          }
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'ESCROW_LOCK',
            amount,
            balanceBefore: balanceAfterTopup,
            balanceAfter: balanceBefore,
            referenceId: payment.job.id,
            description: `Khóa ký quỹ tự động cho công việc: ${payment.job.title}`
          }
        });

        await tx.escrowTransaction.create({
          data: {
            jobId: payment.job.id,
            grossAmount: amount,
            platformFeeRate: 0,
            platformFeeVnd: new Prisma.Decimal(0),
            netWorkerPayout: amount,
            status: 'LOCKED',
            lockedAt: new Date()
          }
        });
        await tx.paymentTransaction.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS', paidAt: new Date(), rawResponse: rawBody.toString('utf8') }
        });
        await tx.job.update({ where: { id: payment.job.id }, data: { status: 'OPEN' } });
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: { isProcessed: true, processedAt: new Date() }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return res.status(200).json({ success: true });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        // SePay retries and manual replay keep the same transaction ID.
        return res.status(200).json({ success: true, duplicate: true });
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
