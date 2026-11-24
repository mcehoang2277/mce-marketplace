import { Router, Request, Response } from 'express';
import { VietQRService } from '../modules/payments/vietqr.service';
import { PaymentWebhookController } from '../modules/payments/payment-webhook.controller';
import { repository } from '../repositories/in-memory.repository';

export const paymentRouter = Router();

paymentRouter.post('/vietqr', (req: Request, res: Response) => {
  const { jobId, amountVnd } = req.body;
  const sampleJob = repository.getSampleJob();
  const id = jobId || sampleJob.id;
  const amount = amountVnd || 240000;
  const paymentInfo = VietQRService.generatePayment(id, amount);

  res.json({ success: true, payment: paymentInfo });
});

paymentRouter.post('/webhook/payment', (req: Request, res: Response) => {
  return PaymentWebhookController.handleBankWebhook(req, res);
});
