import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { ENV } from '../config/env';
import { AppError } from './errors/app-error';

export type AuthenticatedUser = {
  id: string;
  phone: string;
  role: 'WORKER' | 'POSTER' | 'BOTH';
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Vui lòng đăng nhập để tiếp tục.', 401));
  }
  if (!ENV.JWT_SECRET || ENV.JWT_SECRET.length < 32) {
    return next(new AppError('Dịch vụ xác thực chưa được cấu hình an toàn.', 503));
  }

  try {
    const payload = jwt.verify(header.slice(7), ENV.JWT_SECRET) as JwtPayload;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.phone !== 'string' ||
      !['WORKER', 'POSTER', 'BOTH'].includes(payload.role)
    ) {
      return next(new AppError('Phiên đăng nhập không hợp lệ.', 401));
    }
    req.auth = {
      id: payload.sub,
      phone: payload.phone,
      role: payload.role
    };
    return next();
  } catch {
    return next(new AppError('Phiên đăng nhập đã hết hạn hoặc không hợp lệ.', 401));
  }
}

export function requireRole(...roles: AuthenticatedUser['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AppError('Chưa xác thực tài khoản.', 401));
    if (!roles.includes(req.auth.role) && req.auth.role !== 'BOTH') {
      return next(new AppError('Bạn không có quyền thực hiện thao tác này.', 403));
    }
    return next();
  };
}
