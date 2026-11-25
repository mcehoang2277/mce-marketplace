import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { ENV } from '../../config/env';
import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/app-error';

export interface UserSession {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  karmaScore: number;
  isKycVerified: boolean;
  walletBalanceVnd: number;
}

type PublicUserRecord = {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  karmaScore: number;
  isKycVerified: boolean;
  wallet: { availableBalance: { toNumber(): number } } | null;
};

function toSession(user: PublicUserRecord): UserSession {
  return {
    id: user.id,
    name: user.fullName,
    phone: user.phone,
    role: user.role,
    karmaScore: user.karmaScore,
    isKycVerified: user.isKycVerified,
    walletBalanceVnd: user.wallet?.availableBalance.toNumber() ?? 0
  };
}

export class IdentityService {
  public static async register(data: {
    phone: string;
    password: string;
    fullName: string;
    role: UserRole;
  }): Promise<{ user: UserSession; token: string }> {
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw new AppError('Số điện thoại này đã được đăng ký tài khoản.', 409);

    const passwordHash = await bcrypt.hash(data.password, 12);
    try {
      const created = await prisma.user.create({
        data: {
          phone: data.phone,
          fullName: data.fullName,
          role: data.role,
          passwordHash,
          wallet: { create: { availableBalance: 0, lockedBalance: 0 } }
        },
        include: { wallet: true }
      });
      const user = toSession(created);
      return { user, token: this.generateToken(user) };
    } catch (error) {
      // Handle concurrent registration attempts without leaking database details.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new AppError('Số điện thoại này đã được đăng ký tài khoản.', 409);
      }
      throw error;
    }
  }

  public static async login(phone: string, password: string): Promise<{ user: UserSession; token: string }> {
    const record = await prisma.user.findUnique({ where: { phone }, include: { wallet: true } });
    if (!record || !(await bcrypt.compare(password, record.passwordHash))) {
      throw new AppError('Số điện thoại hoặc mật khẩu không chính xác.', 401);
    }

    const user = toSession(record);
    return { user, token: this.generateToken(user) };
  }

  public static generateToken(user: UserSession): string {
    if (!ENV.JWT_SECRET || ENV.JWT_SECRET.length < 32) {
      throw new AppError('JWT_SECRET chưa được cấu hình hoặc có độ dài không an toàn (tối thiểu 32 ký tự).', 503);
    }
    return jwt.sign(
      { phone: user.phone, role: user.role },
      ENV.JWT_SECRET,
      { subject: user.id, expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );
  }
}
