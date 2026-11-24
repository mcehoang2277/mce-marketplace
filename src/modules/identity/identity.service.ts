import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';
import { AppError } from '../../core/errors/app-error';

export interface UserSession {
  id: string;
  name: string;
  phone: string;
  role: 'WORKER' | 'POSTER' | 'BOTH';
  karmaScore: number;
  isKycVerified: boolean;
  walletBalanceVnd: number;
}

export class IdentityService {
  // Bộ nhớ in-memory khởi tạo cho tài khoản demo
  private static users: Map<string, UserSession & { passwordHash: string }> = new Map([
    [
      '0981234567',
      {
        id: 'worker-001',
        name: 'Nguyễn Văn An',
        phone: '0981234567',
        role: 'WORKER',
        karmaScore: 4.9,
        isKycVerified: true,
        walletBalanceVnd: 220800,
        passwordHash: crypto.createHash('sha256').update('123456').digest('hex')
      }
    ],
    [
      '0912345678',
      {
        id: 'poster-001',
        name: 'Chủ Shop Tràng Thi',
        phone: '0912345678',
        role: 'POSTER',
        karmaScore: 5.0,
        isKycVerified: true,
        walletBalanceVnd: 1500000,
        passwordHash: crypto.createHash('sha256').update('123456').digest('hex')
      }
    ]
  ]);

  /**
   * Đăng ký tài khoản mới & Xác thực định danh eKYC
   */
  public static register(data: {
    phone: string;
    password: string;
    fullName: string;
    role: 'WORKER' | 'POSTER' | 'BOTH';
    cccdNumber?: string;
  }): { user: UserSession; token: string } {
    if (this.users.has(data.phone)) {
      throw new AppError('Số điện thoại này đã được đăng ký tài khoản.', 409);
    }

    const userId = `user-${Date.now()}`;
    const passwordHash = crypto.createHash('sha256').update(data.password).digest('hex');

    const newUser: UserSession & { passwordHash: string } = {
      id: userId,
      name: data.fullName,
      phone: data.phone,
      role: data.role,
      karmaScore: 5.0,
      isKycVerified: !!data.cccdNumber,
      walletBalanceVnd: 0,
      passwordHash
    };

    this.users.set(data.phone, newUser);

    const token = this.generateToken(newUser);
    return { user: this.sanitizeUser(newUser), token };
  }

  /**
   * Đăng nhập bằng số điện thoại và mật khẩu
   */
  public static login(phone: string, password: string): { user: UserSession; token: string } {
    const user = this.users.get(phone);
    if (!user) {
      throw new AppError('Số điện thoại hoặc mật khẩu không chính xác.', 401);
    }

    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash !== inputHash) {
      throw new AppError('Số điện thoại hoặc mật khẩu không chính xác.', 401);
    }

    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  /**
   * Sinh JWT Token phiên làm việc
   */
  public static generateToken(user: UserSession): string {
    return jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  private static sanitizeUser(user: UserSession & { passwordHash: string }): UserSession {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
