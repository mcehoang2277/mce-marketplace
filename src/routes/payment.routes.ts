import { Router, Request, Response } from 'express';

export const paymentRouter = Router();

paymentRouter.post('/vietqr', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    status: 'PAYMENT_CREATION_UNAVAILABLE',
    message: 'Chưa thể tạo yêu cầu thanh toán cho đến khi thông tin tài khoản nhận tiền và đối soát được cấu hình, kiểm thử.'
  });
});

paymentRouter.post('/webhook/payment', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    status: 'WEBHOOK_UNAVAILABLE',
    message: 'Webhook ngân hàng đang bị khóa cho đến khi xác thực raw-body HMAC, đối chiếu tài khoản nhận tiền và xử lý Ledger nguyên tử được tích hợp, kiểm thử.'
  });
});
