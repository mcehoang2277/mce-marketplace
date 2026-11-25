import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { IdentityService } from '../modules/identity/identity.service';
import { AppError } from '../core/errors/app-error';
import { requireAuth } from '../core/auth.middleware';
import { z } from 'zod';

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

authRouter.patch('/auth/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      fullName: z.string().trim().min(2).max(100).optional(),
      skills: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
      desiredMinRate: z.number().int().min(0).max(10000000).nullable().optional(),
      avatarUrl: z.string().url().max(1000).nullable().optional()
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
      throw new AppError('Thông tin cập nhật hồ sơ không hợp lệ hoặc không có thay đổi.', 400);
    }
    const user = await IdentityService.updateProfile(req.auth!.id, parsed.data);
    res.json({ success: true, user });
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
