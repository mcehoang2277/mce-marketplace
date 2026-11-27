import { randomBytes } from 'crypto';
import { prisma } from '../../core/database/prisma';
import { ENV } from '../../config/env';
import { AppError } from '../../core/errors/app-error';
import { VietQRService, VietQRPaymentPayload } from './vietqr.service';
import { PaymentProvider, Prisma } from '@prisma/client';
import { findVietnamBank } from './vietnam-banks';

export interface CreatePaymentParams {
  userId: string;
  jobId: string;
}

export class PaymentService {
  /**
   * Creates a pending payment order for the exact server-calculated job budget.
   * A generated VietQR image is only payment instructions, never proof of payment.
   */
  public static async createPaymentRequest(
    params: CreatePaymentParams
  ): Promise<VietQRPaymentPayload & { paymentId: string; referenceCode: string }> {
    const activePlatformBank = await prisma.platformBankAccount.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
    const bankCode = activePlatformBank?.bankCode || ENV.VIETQR_BANK_CODE;
    const accountNo = activePlatformBank?.accountNumber || ENV.VIETQR_ACCOUNT_NO;
    const accountName = activePlatformBank?.accountOwner || ENV.VIETQR_ACCOUNT_NAME;
    const provider: PaymentProvider = activePlatformBank?.provider || PaymentProvider.SEPAY;
    const bankMeta = findVietnamBank(bankCode);

    if (!bankCode || !accountNo || !accountName) {
      throw new AppError('Chưa cấu hình tài khoản ngân hàng nhận tiền VietQR trên máy chủ hoặc Admin Ops.', 503);
    }

    const referenceCode = 'MCE' + randomBytes(6).toString('hex').toUpperCase();
    try {
      return await prisma.$transaction(async (tx) => {
        // Serialize payment-intent creation per job; the partial unique index is the final guard.
        await tx.$queryRawUnsafe('SELECT "id" FROM "Job" WHERE "id" = $1 FOR UPDATE', params.jobId);
        const job = await tx.job.findUnique({ where: { id: params.jobId } });
        if (!job) throw new AppError('Không tìm thấy công việc.', 404);
        if (job.posterId !== params.userId) throw new AppError('Bạn không có quyền thanh toán công việc này.', 403);
        if (job.status !== 'DRAFT') throw new AppError('Chỉ công việc ở trạng thái nháp mới được tạo yêu cầu ký quỹ.', 409);
        const amount = job.totalEstimatedVnd.toNumber();
        if (!Number.isSafeInteger(amount) || amount < 10000) throw new AppError('Ngân sách công việc không hợp lệ (tối thiểu 10.000 VNĐ).', 400);
        await tx.paymentTransaction.updateMany({
          where: { userId: params.userId, jobId: job.id, status: 'PENDING', createdAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
          data: { status: 'EXPIRED' }
        });
        const recentPending = await tx.paymentTransaction.findFirst({
          where: { userId: params.userId, jobId: job.id, status: 'PENDING', createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
          orderBy: { createdAt: 'desc' }
        });
        if (recentPending && recentPending.qrCodeUrl) {
          return {
            bankCode, bankName: bankMeta?.shortName || activePlatformBank?.bankName || bankCode,
            accountNumber: accountNo, accountName,
            amountVnd: recentPending.amount.toNumber(), transferContent: recentPending.transferContent,
            qrImageUrl: recentPending.qrCodeUrl, status: 'WAITING_PAYMENT',
            paymentId: recentPending.id, referenceCode: recentPending.referenceCode
          };
        }
        const vietQrData = VietQRService.generatePayment(referenceCode, amount, bankCode, accountNo, accountName);
        const paymentRecord = await tx.paymentTransaction.create({
          data: {
            userId: params.userId, jobId: job.id, provider, referenceCode,
            amount: new Prisma.Decimal(amount), status: 'PENDING',
            transferContent: vietQrData.transferContent, qrCodeUrl: vietQrData.qrImageUrl
          }
        });
        return { ...vietQrData, bankName: bankMeta?.shortName || activePlatformBank?.bankName || bankCode, paymentId: paymentRecord.id, referenceCode };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (!['P2002', 'P2034'].includes(code)) throw error;
      // If a parallel request won the partial unique index, reuse its still-valid intent.
      const existing = await prisma.paymentTransaction.findFirst({
        where: { userId: params.userId, jobId: params.jobId, status: 'PENDING', createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' }
      });
      if (existing && existing.qrCodeUrl) {
        return {
          bankCode, bankName: bankMeta?.shortName || activePlatformBank?.bankName || bankCode,
          accountNumber: accountNo, accountName,
          amountVnd: existing.amount.toNumber(), transferContent: existing.transferContent,
          qrImageUrl: existing.qrCodeUrl, status: 'WAITING_PAYMENT',
          paymentId: existing.id, referenceCode: existing.referenceCode
        };
      }
      throw error;
    }
  }

  public static async getPaymentStatus(paymentId: string, userId: string) {
    const payment = await prisma.paymentTransaction.findFirst({
      where: { id: paymentId, userId },
      select: {
        id: true,
        jobId: true,
        referenceCode: true,
        amount: true,
        status: true,
        transferContent: true,
        paidAt: true,
        createdAt: true
      }
    });
    if (!payment) throw new AppError('Không tìm thấy giao dịch thanh toán.', 404);
    return { ...payment, amount: payment.amount.toNumber() };
  }
}
