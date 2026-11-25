import { Router, Request, Response } from 'express';
import { PaymentWebhookController } from '../modules/payments/payment-webhook.controller';

export const paymentRouter = Router();

paymentRouter.post('/vietqr', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    status: 'PAYMENT_CREATION_UNAVAILABLE',
    message: 'Chưa thể tạo yêu cầu thanh toán cho đến khi thông tin tài khoản nhận tiền và đối soát được cấu hình, kiểm thử.'
  });
});

paymentRouter.post('/webhook/payment', (req: Request, res: Response) => {
  return PaymentWebhookController.handleBankWebhook(req, res);
});
