import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { IdentityService } from '../modules/identity/identity.service';
import { AppError } from '../core/errors/app-error';
import { requireAuth } from '../core/auth.middleware';

export const authRouter = Router();

authRouter.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, password, fullName, role } = req.body;
    if (
      typeof phone !== 'string' || !/^\+?[0-9]{9,15}$/.test(phone) ||
      typeof password !== 'string' || password.length < 10 ||
      typeof fullName !== 'string' || fullName.trim().length < 2 ||
      !['WORKER', 'POSTER', 'BOTH'].includes(role || 'WORKER')
    ) {
      throw new AppError('Thông tin đăng ký không hợp lệ. Mật khẩu phải có ít nhất 10 ký tự.', 400);
    }

    const result = await IdentityService.register({
      phone,
      password,
      fullName: fullName.trim(),
      role: (role || 'WORKER') as UserRole
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, password } = req.body;
    if (typeof phone !== 'string' || typeof password !== 'string' || !phone || !password) {
      throw new AppError('Vui lòng nhập số điện thoại và mật khẩu.', 400);
    }
    const result = await IdentityService.login(phone, password);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/auth/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await IdentityService.getProfile(req.auth!.id);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});
