import { Request, Response } from 'express';

/**
 * Payment webhooks are intentionally disabled until a provider-specific adapter
 * verifies the signature against the exact raw request bytes and reconciles the
 * receiver account, amount, currency and unique bank transaction reference.
 * Never credit a wallet or lock escrow from an unverified HTTP payload.
 */
export class PaymentWebhookController {
  public static async handleBankWebhook(_req: Request, res: Response) {
    return res.status(503).json({
      success: false,
      status: 'PAYMENT_WEBHOOK_NOT_CONFIGURED',
      message: 'Webhook thanh toán đang tạm khóa. Cần cấu hình và kiểm thử xác thực chữ ký theo nhà cung cấp trước khi ghi nhận tiền.'
    });
  }

  public static async simulateWebhook(_req: Request, res: Response) {
    return res.status(503).json({
      success: false,
      status: 'PAYMENT_SIMULATION_DISABLED',
      message: 'Không hỗ trợ giả lập thanh toán trên môi trường ứng dụng.'
    });
  }
}
