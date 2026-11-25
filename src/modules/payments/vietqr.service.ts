import { ENV } from '../../config/env';

export interface VietQRPaymentPayload {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amountVnd: number;
  transferContent: string;
  qrImageUrl: string;
  status: 'WAITING_PAYMENT' | 'PAID' | 'EXPIRED';
}

export class VietQRService {
  /**
   * Sinh thông tin thanh toán chuyển khoản và link mã QR chuẩn NAPAS 247
   */
  public static generatePayment(
    jobId: string,
    amountVnd: number,
    bankCode: string = ENV.VIETQR_BANK_CODE,
    accountNo: string = ENV.VIETQR_ACCOUNT_NO,
    accountName: string = ENV.VIETQR_ACCOUNT_NAME
  ): VietQRPaymentPayload {
    // Cú pháp nội dung chuyển khoản chuẩn hóa: MCE <MÃ CÔNG VIỆC>
    const transferContent = `MCE ${jobId.toUpperCase().replace(/\s+/g, '_')}`;

    const encodedContent = encodeURIComponent(transferContent);
    const encodedName = encodeURIComponent(accountName);

    // Link ảnh VietQR tự động qua chuẩn API liên ngân hàng
    const qrImageUrl =
      `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact2.png` +
      `?amount=${amountVnd}&addInfo=${encodedContent}&accountName=${encodedName}`;

    return {
      bankCode,
      bankName: bankCode,
      accountNumber: accountNo,
      accountName,
      amountVnd,
      transferContent,
      qrImageUrl,
      status: 'WAITING_PAYMENT'
    };
  }
}
