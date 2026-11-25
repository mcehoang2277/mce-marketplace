import { Request, Response } from 'express';

/**
 * Payment webhooks stay fail-closed until payment events, idempotency keys,
 * escrow ledger updates, and bank signature verification share one durable
 * database transaction. The previous implementation acknowledged deposits
 * while mutating an in-memory ledger, which is unsafe for real money.
 */
export class PaymentWebhookController {
  public static handleBankWebhook(_req: Request, res: Response) {
    return res.status(503).json({
      success: false,
      status: 'PAYMENT_WEBHOOK_DISABLED',
      message: 'Webhook tạm khóa. Cần hoàn thiện đối soát chữ ký và sổ cái giao dịch PostgreSQL trước khi nhận thanh toán thật.'
    });
  }
}
