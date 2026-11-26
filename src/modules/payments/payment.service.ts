import { randomBytes } from 'crypto';
import { prisma } from '../../core/database/prisma';
import { ENV } from '../../config/env';
import { AppError } from '../../core/errors/app-error';
import { VietQRService, VietQRPaymentPayload } from './vietqr.service';
import { Prisma } from '@prisma/client';

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
    if (!ENV.VIETQR_BANK_CODE || !ENV.VIETQR_ACCOUNT_NO || !ENV.VIETQR_ACCOUNT_NAME) {
      throw new AppError('Chưa cấu hình tài khoản nhận tiền VietQR trên máy chủ.', 503);
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
            bankCode: ENV.VIETQR_BANK_CODE, bankName: 'Ngân hàng nhận tiền đã cấu hình',
            accountNumber: ENV.VIETQR_ACCOUNT_NO, accountName: ENV.VIETQR_ACCOUNT_NAME,
            amountVnd: recentPending.amount.toNumber(), transferContent: recentPending.transferContent,
            qrImageUrl: recentPending.qrCodeUrl, status: 'WAITING_PAYMENT',
            paymentId: recentPending.id, referenceCode: recentPending.referenceCode
          };
        }
        const vietQrData = VietQRService.generatePayment(referenceCode, amount, ENV.VIETQR_BANK_CODE, ENV.VIETQR_ACCOUNT_NO, ENV.VIETQR_ACCOUNT_NAME);
        const paymentRecord = await tx.paymentTransaction.create({
          data: {
            userId: params.userId, jobId: job.id, provider: 'SEPAY', referenceCode,
            amount: new Prisma.Decimal(amount), status: 'PENDING',
            transferContent: vietQrData.transferContent, qrCodeUrl: vietQrData.qrImageUrl
          }
        });
        return { ...vietQrData, paymentId: paymentRecord.id, referenceCode };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // If a parallel request won the partial unique index, reuse its still-valid intent.
      const existing = await prisma.paymentTransaction.findFirst({
        where: { userId: params.userId, jobId: params.jobId, status: 'PENDING', createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' }
      });
      if (existing && existing.qrCodeUrl) {
        return {
          bankCode: ENV.VIETQR_BANK_CODE, bankName: 'Ngân hàng nhận tiền đã cấu hình',
          accountNumber: ENV.VIETQR_ACCOUNT_NO, accountName: ENV.VIETQR_ACCOUNT_NAME,
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
