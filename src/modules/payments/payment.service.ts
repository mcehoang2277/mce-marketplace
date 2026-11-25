import { prisma } from '../../core/database/prisma';
import { ENV } from '../../config/env';
import { VietQRService, VietQRPaymentPayload } from './vietqr.service';
import { Prisma } from '@prisma/client';

export interface CreatePaymentParams {
  userId: string;
  jobId?: string;
  amount: number;
  provider?: 'VIETQR' | 'PAYOS' | 'SEPAY';
  type?: 'ESCROW_DEPOSIT' | 'WALLET_TOPUP';
}

export class PaymentService {
  /**
   * Tạo đơn thanh toán và sinh mã VietQR chuyển khoản liên ngân hàng 24/7
   */
  public static async createPaymentRequest(params: CreatePaymentParams): Promise<VietQRPaymentPayload & { paymentId: string; referenceCode: string }> {
    const { userId, jobId, amount, provider = 'VIETQR' } = params;

    const refSuffix = Date.now().toString().slice(-6);
    const referenceCode = jobId ? `MCE_${jobId.toUpperCase().replace(/\s+/g, '_')}` : `MCE_TOPUP_${refSuffix}`;

    const vietQrData = VietQRService.generatePayment(
      referenceCode,
      amount,
      ENV.VIETQR_BANK_CODE,
      ENV.VIETQR_ACCOUNT_NO,
      ENV.VIETQR_ACCOUNT_NAME
    );

    const paymentRecord = await prisma.paymentTransaction.create({
      data: {
        userId,
        jobId: jobId || null,
        provider,
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
}
