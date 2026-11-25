import { Router, Request, Response, NextFunction } from 'express';
import { JobStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../core/auth.middleware';
import { prisma } from '../core/database/prisma';
import { AppError } from '../core/errors/app-error';

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
        select: { id: true, fullName: true, phone: true, role: true, karmaScore: true, isKycVerified: true, isPhoneVerified: true, createdAt: true,
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
    const disputes = await prisma.dispute.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' },
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
