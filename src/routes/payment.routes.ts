import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../core/auth.middleware';
import { AppError } from '../core/errors/app-error';
import { PaymentService } from '../modules/payments/payment.service';
import { PaymentWebhookController } from '../modules/payments/payment-webhook.controller';
import { searchVietnamBanks } from '../modules/payments/vietnam-banks';

export const paymentRouter = Router();

paymentRouter.get('/banks', (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const banks = searchVietnamBanks(q);
  res.json({ success: true, total: banks.length, banks });
});

paymentRouter.post('/vietqr', requireAuth, requireRole('POSTER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (typeof req.body?.jobId !== 'string' || !req.body.jobId.trim()) {
      throw new AppError('Thiếu mã công việc cần ký quỹ.', 400);
    }
    const payment = await PaymentService.createPaymentRequest({
      userId: req.auth!.id,
      jobId: req.body.jobId.trim()
    });
    res.status(201).json({
      success: true,
      payment,
      notice: 'QR chỉ là hướng dẫn chuyển khoản. Công việc chỉ mở sau khi ngân hàng/đơn vị đối soát xác nhận giao dịch thật.'
    });
  } catch (error) {
    next(error);
  }
});

paymentRouter.get('/vietqr/:paymentId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await PaymentService.getPaymentStatus(req.params.paymentId, req.auth!.id);
    res.json({ success: true, payment });
  } catch (error) {
    next(error);
  }
});

// Kept closed until a named bank aggregator and its official signature contract are configured.
paymentRouter.post('/webhook/payment', (req: Request, res: Response) => {
  return PaymentWebhookController.handleBankWebhook(req, res);
});
