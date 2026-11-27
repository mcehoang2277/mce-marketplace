import { Router, Request, Response, NextFunction } from 'express';
import { JobStatus, PaymentProvider, UserRole } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../core/auth.middleware';
import { prisma } from '../core/database/prisma';
import { AppError } from '../core/errors/app-error';
import { ENV } from '../config/env';
import { findVietnamBank } from '../modules/payments/vietnam-banks';
import { VietQRService } from '../modules/payments/vietqr.service';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/admin/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [users, jobs, applications, payments, disputes, openDisputes, usersByRole, jobsByStatus, paymentVolume] = await Promise.all([
      prisma.user.count(), prisma.job.count(), prisma.application.count(), prisma.paymentTransaction.count(),
      prisma.dispute.count(), prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.paymentTransaction.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } })
    ]);
    res.json({ success: true, overview: {
      users, jobs, applications, payments, disputes, openDisputes,
      successfulPaymentVolumeVnd: paymentVolume._sum.amount?.toNumber() ?? 0,
      usersByRole: usersByRole.map(x => ({ role: x.role, count: x._count._all })),
      jobsByStatus: jobsByStatus.map(x => ({ status: x.status, count: x._count._all }))
    }});
  } catch (error) { next(error); }
});

adminRouter.get('/admin/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(100).optional() }).safeParse(req.query);
    if (!parsed.success) throw new AppError('Tham số truy vấn không hợp lệ.', 400);
    const { page, limit, q } = parsed.data;
    const where = q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { phone: { contains: q } }] } : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        select: { id: true, fullName: true, phone: true, role: true, karmaScore: true, isKycVerified: true, isPhoneVerified: true, bankName: true, bankAccountNumber: true, bankAccountOwner: true, createdAt: true,
          wallet: { select: { availableBalance: true, lockedBalance: true } } }
      })
    ]);
    res.json({ success: true, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, users });
  } catch (error) { next(error); }
});

adminRouter.patch('/admin/users/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ role: z.nativeEnum(UserRole).optional(), isKycVerified: z.boolean().optional(), isPhoneVerified: z.boolean().optional() }).strict().safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) throw new AppError('Dữ liệu cập nhật tài khoản không hợp lệ.', 400);
    if (req.params.userId === req.auth!.id && parsed.data.role && parsed.data.role !== 'ADMIN') throw new AppError('Không thể tự hạ quyền quản trị của chính mình.', 409);
    const target = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true, role: true } });
    if (!target) throw new AppError('Không tìm thấy người dùng.', 404);
    if (target.role === 'ADMIN' && parsed.data.role && parsed.data.role !== 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw new AppError('Không thể hạ quyền quản trị viên cuối cùng.', 409);
    }
    const user = await prisma.user.update({ where: { id: target.id }, data: parsed.data,
      select: { id: true, fullName: true, phone: true, role: true, isKycVerified: true, isPhoneVerified: true, karmaScore: true } });
    res.json({ success: true, user });
  } catch (error) { next(error); }
});

adminRouter.get('/admin/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: z.nativeEnum(JobStatus).optional() }).safeParse(req.query);
    if (!parsed.success) throw new AppError('Bộ lọc ca việc không hợp lệ.', 400);
    const { page, limit, status } = parsed.data;
    const where = status ? { status } : {};
    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { poster: { select: { id: true, fullName: true, phone: true } }, worker: { select: { id: true, fullName: true, phone: true } } } })
    ]);
    res.json({ success: true, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, jobs });
  } catch (error) { next(error); }
});

adminRouter.patch('/admin/jobs/:jobId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ status: z.enum(['OPEN', 'CANCELLED', 'DISPUTED']) }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Trạng thái quản trị không hợp lệ.', 400);
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId }, select: { id: true, status: true } });
    if (!job) throw new AppError('Không tìm thấy ca việc.', 404);
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) throw new AppError('Không thể thay đổi ca việc đã kết thúc.', 409);
    const updated = await prisma.job.update({ where: { id: job.id }, data: { status: parsed.data.status as JobStatus } });
    res.json({ success: true, job: updated });
  } catch (error) { next(error); }
});

adminRouter.get('/admin/disputes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const disputes = await prisma.dispute.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 100,
      include: { job: { select: { id: true, title: true, status: true, totalEstimatedVnd: true,
        poster: { select: { id: true, fullName: true, phone: true } },
        worker: { select: { id: true, fullName: true, phone: true } } } } } });
    res.json({ success: true, disputes });
  } catch (error) { next(error); }
});

adminRouter.patch('/admin/disputes/:disputeId/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ status: z.enum(['RESOLVED_POSTER', 'RESOLVED_WORKER', 'SPLIT']), resolution: z.string().trim().min(10).max(2000) }).strict().safeParse(req.body);
    if (!parsed.success) throw new AppError('Cần chọn kết quả và ghi rõ biên bản xử lý (ít nhất 10 ký tự).', 400);
    const dispute = await prisma.dispute.findUnique({ where: { id: req.params.disputeId }, select: { id: true, jobId: true, status: true } });
    if (!dispute) throw new AppError('Không tìm thấy tranh chấp.', 404);
    if (dispute.status !== 'OPEN') throw new AppError('Tranh chấp này đã được xử lý.', 409);
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.dispute.update({ where: { id: dispute.id }, data: { status: parsed.data.status, resolution: parsed.data.resolution, resolvedAt: new Date() } });
      await tx.job.update({ where: { id: dispute.jobId }, data: { status: JobStatus.DISPUTED } });
      return result;
    });
    res.json({ success: true, dispute: updated, notice: 'Đã ghi nhận kết quả xử lý. Việc chuyển tiền/hoàn tiền vẫn cần quy trình đối soát tài chính riêng.' });
  } catch (error) { next(error); }
});

adminRouter.get('/admin/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(req.query);
    if (!parsed.success) throw new AppError('Tham số phân trang không hợp lệ.', 400);
    const { page, limit } = parsed.data;
    const [total, payments] = await Promise.all([
      prisma.paymentTransaction.count(),
      prisma.paymentTransaction.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        select: { id: true, referenceCode: true, amount: true, status: true, provider: true, transferContent: true, paidAt: true, createdAt: true,
          user: { select: { id: true, fullName: true, phone: true } }, job: { select: { id: true, title: true } } } })
    ]);
    res.json({ success: true, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      payments: payments.map(p => ({ ...p, amountVnd: p.amount.toNumber(), amount: undefined })) });
  } catch (error) { next(error); }
});

const platformBankCreateSchema = z.object({
  bank: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().regex(/^[A-Za-z0-9]{6,20}$/, 'Số tài khoản phải gồm 6–20 ký tự chữ/số.'),
  accountOwner: z.string().trim().min(2).max(80),
  branch: z.string().trim().max(120).optional().nullable(),
  provider: z.nativeEnum(PaymentProvider).default(PaymentProvider.SEPAY),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

const platformBankPatchSchema = platformBankCreateSchema.partial().strict();

const adminUserBankSchema = z.union([
  z.object({ clear: z.literal(true) }).strict(),
  z.object({
    bank: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().regex(/^[A-Za-z0-9]{6,20}$/, 'Số tài khoản phải gồm 6–20 ký tự chữ/số.'),
    accountOwner: z.string().trim().min(2).max(80)
  }).strict()
]);

adminRouter.patch('/admin/users/:userId/bank', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminUserBankSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Dữ liệu ngân hàng không hợp lệ.', 400);
    const target = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true } });
    if (!target) throw new AppError('Không tìm thấy người dùng.', 404);

    if ('clear' in parsed.data) {
      const user = await prisma.user.update({
        where: { id: target.id },
        data: { bankName: null, bankAccountNumber: null, bankAccountOwner: null },
        select: { id: true, bankName: true, bankAccountNumber: true, bankAccountOwner: true }
      });
      return res.json({ success: true, message: 'Đã xóa liên kết ngân hàng của tài khoản.', user });
    }

    const bankMeta = findVietnamBank(parsed.data.bank);
    if (!bankMeta) throw new AppError('Ngân hàng không thuộc danh mục NAPAS 24/7 hỗ trợ.', 400);
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        bankName: bankMeta.shortName,
        bankAccountNumber: parsed.data.accountNumber.toUpperCase(),
        bankAccountOwner: parsed.data.accountOwner.toUpperCase()
      },
      select: { id: true, bankName: true, bankAccountNumber: true, bankAccountOwner: true }
    });
    res.json({ success: true, message: `Đã cập nhật tài khoản ${bankMeta.shortName} cho người dùng.`, user });
  } catch (error) { next(error); }
});

adminRouter.get('/admin/banks', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const banks = await prisma.platformBankAccount.findMany({
      orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { createdAt: 'asc' }]
    });
    const withPreview = banks.map((item) => ({
      ...item,
      qrPreviewUrl: VietQRService.generatePayment('MCE_TEST', 10000, item.bankCode, item.accountNumber, item.accountOwner).qrImageUrl
    }));
    const sepayConfigured = Boolean(ENV.SEPAY_WEBHOOK_SECRET && ENV.SEPAY_WEBHOOK_SECRET.length >= 32);
    const envBankConfigured = Boolean(ENV.VIETQR_BANK_CODE && ENV.VIETQR_ACCOUNT_NO && ENV.VIETQR_ACCOUNT_NAME);
    res.json({
      success: true,
      banks: withPreview,
      integration: {
        webhookEndpoint: '/api/webhook/payment',
        sepayHmacConfigured: sepayConfigured,
        envFallbackAccount: envBankConfigured ? {
          bankCode: ENV.VIETQR_BANK_CODE,
          accountNumber: ENV.VIETQR_ACCOUNT_NO,
          accountOwner: ENV.VIETQR_ACCOUNT_NAME
        } : null
      },
      enterpriseChecklist: [
        { key: 'VIETQR_NAPAS', title: 'VietQR động chuẩn NAPAS 24/7', ready: banks.some(b => b.isActive) || envBankConfigured, detail: 'Mỗi ca việc sinh mã tham chiếu MCE duy nhất tránh nhầm giao dịch.' },
        { key: 'BANK_WEBHOOK_HMAC', title: 'Webhook nhận biến động số dư (SePay / PayOS / Casso)', ready: sepayConfigured, detail: 'Xác thực chữ ký HMAC-SHA256 + timestamp trên rawBody để tự động khóa Escrow.' },
        { key: 'LEDGER_SUSPENSE', title: 'Sổ cái kép & Tài khoản treo (SUSPENSE)', ready: true, detail: 'Tiền chuyển nhầm nội dung/thiếu tiền được giữ vào SUSPENSE để đối soát.' },
        { key: 'BANK_NAME_MATCH', title: 'Đối khớp tên chủ TK ngân hàng ↔ Họ tên eKYC CCCD', ready: false, detail: 'Khuyến nghị tra cứu tên chủ TK qua API VietQR/Napas trước khi cho rút tiền.' },
        { key: 'AUTO_DISBURSEMENT', title: 'Chi hộ tự động 24/7 (Payout API)', ready: false, detail: 'Kết nối API chuyển tiền nhanh ngân hàng/trung gian thanh toán với hạn mức & 2FA duyệt chi.' },
        { key: 'DAILY_RECON', title: 'Đối soát sao kê cuối ngày (Reconciliation)', ready: true, detail: 'Chạy SQL đối chiếu tổng tiền ngân hàng thực nhận vs tổng số dư ví & ký quỹ.' }
      ]
    });
  } catch (error) { next(error); }
});

adminRouter.post('/admin/banks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = platformBankCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Dữ liệu tài khoản ngân hàng sàn không hợp lệ.', 400);
    const bankMeta = findVietnamBank(parsed.data.bank);
    if (!bankMeta) throw new AppError('Vui lòng chọn ngân hàng từ danh mục NAPAS 24/7 được hỗ trợ.', 400);

    const created = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.platformBankAccount.count();
      const shouldBeDefault = parsed.data.isDefault || existingCount === 0;
      if (shouldBeDefault) {
        await tx.platformBankAccount.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.platformBankAccount.create({
        data: {
          bankCode: bankMeta.code,
          bankBin: bankMeta.bin,
          bankName: bankMeta.shortName,
          accountNumber: parsed.data.accountNumber.toUpperCase(),
          accountOwner: parsed.data.accountOwner.toUpperCase(),
          branch: parsed.data.branch || null,
          provider: parsed.data.provider,
          isDefault: shouldBeDefault,
          isActive: parsed.data.isActive
        }
      });
    });
    res.status(201).json({ success: true, bank: created });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return next(new AppError('Số tài khoản ngân hàng này đã tồn tại trên hệ thống.', 409));
    }
    next(error);
  }
});

adminRouter.patch('/admin/banks/:bankId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = platformBankPatchSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
      throw new AppError(parsed.error?.issues?.[0]?.message || 'Dữ liệu cập nhật không hợp lệ.', 400);
    }
    const existing = await prisma.platformBankAccount.findUnique({ where: { id: req.params.bankId } });
    if (!existing) throw new AppError('Không tìm thấy tài khoản ngân hàng cần sửa.', 404);

    let bankUpdate: { bankCode?: string; bankBin?: string; bankName?: string } = {};
    if (parsed.data.bank) {
      const bankMeta = findVietnamBank(parsed.data.bank);
      if (!bankMeta) throw new AppError('Ngân hàng không thuộc danh mục NAPAS 24/7 được hỗ trợ.', 400);
      bankUpdate = { bankCode: bankMeta.code, bankBin: bankMeta.bin, bankName: bankMeta.shortName };
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault === true) {
        await tx.platformBankAccount.updateMany({ where: { isDefault: true, id: { not: existing.id } }, data: { isDefault: false } });
      }
      return tx.platformBankAccount.update({
        where: { id: existing.id },
        data: {
          ...bankUpdate,
          ...(parsed.data.accountNumber ? { accountNumber: parsed.data.accountNumber.toUpperCase() } : {}),
          ...(parsed.data.accountOwner ? { accountOwner: parsed.data.accountOwner.toUpperCase() } : {}),
          ...(parsed.data.branch !== undefined ? { branch: parsed.data.branch || null } : {}),
          ...(parsed.data.provider ? { provider: parsed.data.provider } : {}),
          ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
        }
      });
    });
    res.json({ success: true, bank: updated });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return next(new AppError('Số tài khoản ngân hàng này đã bị trùng.', 409));
    }
    next(error);
  }
});

adminRouter.delete('/admin/banks/:bankId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.platformBankAccount.findUnique({ where: { id: req.params.bankId } });
    if (!existing) throw new AppError('Không tìm thấy tài khoản ngân hàng.', 404);

    await prisma.$transaction(async (tx) => {
      await tx.platformBankAccount.delete({ where: { id: existing.id } });
      if (existing.isDefault) {
        const replacement = await tx.platformBankAccount.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
        if (replacement) {
          await tx.platformBankAccount.update({ where: { id: replacement.id }, data: { isDefault: true } });
        }
      }
    });
    res.json({ success: true, message: 'Đã xóa tài khoản ngân hàng sàn.' });
  } catch (error) { next(error); }
});
