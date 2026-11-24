import { Router, Request, Response } from 'express';
import { IdentityService } from '../modules/identity/identity.service';
import { AppError } from '../core/errors/app-error';

export const authRouter = Router();

authRouter.post('/auth/register', (req: Request, res: Response) => {
  const { phone, password, fullName, role, cccdNumber } = req.body;
  if (!phone || !password || !fullName) {
    throw new AppError('Vui lòng điền đầy đủ số điện thoại, mật khẩu và họ tên.', 400);
  }
  const result = IdentityService.register({
    phone,
    password,
    fullName,
    role: role || 'WORKER',
    cccdNumber
  });
  res.status(201).json({ success: true, ...result });
});

authRouter.post('/auth/login', (req: Request, res: Response) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    throw new AppError('Vui lòng nhập số điện thoại và mật khẩu.', 400);
  }
  const result = IdentityService.login(phone, password);
  res.json({ success: true, ...result });
});
