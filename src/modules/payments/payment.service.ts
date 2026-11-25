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

    const job = await prisma.job.findUnique({ where: { id: params.jobId } });
    if (!job) throw new AppError('Không tìm thấy công việc.', 404);
    if (job.posterId !== params.userId) throw new AppError('Bạn không có quyền thanh toán công việc này.', 403);
    if (job.status !== 'DRAFT') throw new AppError('Chỉ công việc ở trạng thái nháp mới được tạo yêu cầu ký quỹ.', 409);

    const amount = job.totalEstimatedVnd.toNumber();
    if (!Number.isSafeInteger(amount) || amount < 10000) {
      throw new AppError('Ngân sách công việc không hợp lệ (tối thiểu 10.000 VNĐ).', 400);
    }

    const recentPending = await prisma.paymentTransaction.findFirst({
      where: {
        userId: params.userId,
        jobId: job.id,
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (recentPending?.qrCodeUrl) {
      return {
        bankCode: ENV.VIETQR_BANK_CODE,
        bankName: 'Ngân hàng nhận tiền đã cấu hình',
        accountNumber: ENV.VIETQR_ACCOUNT_NO,
        accountName: ENV.VIETQR_ACCOUNT_NAME,
        amountVnd: recentPending.amount.toNumber(),
        transferContent: recentPending.transferContent,
        qrImageUrl: recentPending.qrCodeUrl,
        status: 'WAITING_PAYMENT',
        paymentId: recentPending.id,
        referenceCode: recentPending.referenceCode
      };
    }

    const referenceCode = `MCE${randomBytes(6).toString('hex').toUpperCase()}`;
    const vietQrData = VietQRService.generatePayment(
      referenceCode,
      amount,
      ENV.VIETQR_BANK_CODE,
      ENV.VIETQR_ACCOUNT_NO,
      ENV.VIETQR_ACCOUNT_NAME
    );

    const paymentRecord = await prisma.paymentTransaction.create({
      data: {
        userId: params.userId,
        jobId: job.id,
        provider: 'VIETQR',
        referenceCode,
        amount: new Prisma.Decimal(amount),
        status: 'PENDING',
        transferContent: vietQrData.transferContent,
        qrCodeUrl: vietQrData.qrImageUrl
      }
    });

    return {
      ...vietQrData,
      paymentId: paymentRecord.id,
      referenceCode
    };
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
