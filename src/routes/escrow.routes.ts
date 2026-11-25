import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../core/auth.middleware';
import { AppError } from '../core/errors/app-error';
import { PostgresEscrowService } from '../modules/escrow/postgres-escrow.service';
import { prisma } from '../core/database/prisma';

export const escrowRouter = Router();

// Wallet-backed escrow only. No endpoint accepts an arbitrary beneficiary or amount:
// the service verifies ownership and the server-calculated job budget transactionally.
escrowRouter.post('/escrow/lock', requireAuth, requireRole('POSTER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ jobId: z.string().uuid() }).strict().safeParse(req.body);
    if (!parsed.success) throw new AppError('Mã công việc không hợp lệ.', 400);
    const job = await prisma.job.findUnique({ where: { id: parsed.data.jobId }, select: { totalEstimatedVnd: true } });
    if (!job) throw new AppError('Không tìm thấy công việc.', 404);
    const result = await PostgresEscrowService.lockEscrowTx(parsed.data.jobId, req.auth!.id, job.totalEstimatedVnd.toNumber());
    res.json({ success: true, escrow: result, message: 'Đã khóa ký quỹ từ số dư ví. Công việc được mở để nhận ứng tuyển.' });
  } catch (error) { next(error); }
});

escrowRouter.post('/escrow/refund', requireAuth, requireRole('POSTER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ jobId: z.string().uuid(), reason: z.string().trim().min(10).max(500) }).strict().safeParse(req.body);
    if (!parsed.success) throw new AppError('Mã công việc hoặc lý do hoàn ký quỹ không hợp lệ.', 400);
    const result = await PostgresEscrowService.refundEscrowTx(parsed.data.jobId, req.auth!.id, parsed.data.reason);
    res.json({ success: true, escrow: result, message: 'Đã hoàn ký quỹ về ví người thuê.' });
  } catch (error) { next(error); }
});

escrowRouter.get('/escrow/jobs/:jobId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const escrow = await prisma.escrowTransaction.findUnique({ where: { jobId: req.params.jobId }, include: { job: { select: { posterId: true, workerId: true } } } });
    if (!escrow) throw new AppError('Chưa có khoản ký quỹ cho công việc này.', 404);
    if (escrow.job.posterId !== req.auth!.id && escrow.job.workerId !== req.auth!.id && req.auth!.role !== 'ADMIN') {
      throw new AppError('Bạn không có quyền xem khoản ký quỹ này.', 403);
    }
    res.json({ success: true, escrow: { id: escrow.id, jobId: escrow.jobId, grossAmountVnd: escrow.grossAmount.toNumber(),
      platformFeeVnd: escrow.platformFeeVnd.toNumber(), netWorkerPayoutVnd: escrow.netWorkerPayout.toNumber(),
      status: escrow.status, lockedAt: escrow.lockedAt, releasedAt: escrow.releasedAt, refundedAt: escrow.refundedAt } });
  } catch (error) { next(error); }
});
