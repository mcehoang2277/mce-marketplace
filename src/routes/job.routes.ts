import { Router, Request, Response, NextFunction } from 'express';
import { JobStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../core/database/prisma';
import { requireAuth, requireRole } from '../core/auth.middleware';
import { AppError } from '../core/errors/app-error';

export const jobRouter = Router();

const createJobSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(2).max(80),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  hourlyRate: z.number().int().positive().max(10000000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  addressText: z.string().trim().min(5).max(500),
  requiredSkills: z.array(z.string().trim().min(1).max(50)).max(30).default([])
});

// Public job discovery reads persistent PostgreSQL data.
jobRouter.get('/jobs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: JobStatus.OPEN },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { poster: { select: { id: true, fullName: true, karmaScore: true } } }
    });
    res.json({ success: true, jobs });
  } catch (error) {
    next(error);
  }
});

jobRouter.post('/jobs', requireAuth, requireRole('POSTER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createJobSchema.safeParse(req.body);
    if (!input.success) throw new AppError('Thông tin công việc không hợp lệ.', 400);

    const startTime = new Date(input.data.startTime);
    const endTime = new Date(input.data.endTime);
    const durationHours = (endTime.getTime() - startTime.getTime()) / 3600000;
    if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 24 * 30) {
      throw new AppError('Thời gian kết thúc phải sau thời gian bắt đầu và không vượt quá 30 ngày.', 400);
    }

    const totalEstimatedVnd = Math.round(durationHours * input.data.hourlyRate);
    const job = await prisma.job.create({
      data: {
        ...input.data,
        startTime,
        endTime,
        totalEstimatedVnd,
        posterId: req.auth!.id,
        status: JobStatus.DRAFT
      }
    });
    res.status(201).json({ success: true, job, nextStep: 'ESCROW_FUNDING_REQUIRED' });
  } catch (error) {
    next(error);
  }
});

jobRouter.post('/jobs/:jobId/applications', requireAuth, requireRole('WORKER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job || job.status !== JobStatus.OPEN) throw new AppError('Công việc không tồn tại hoặc đã đóng.', 404);
    if (job.posterId === req.auth!.id) throw new AppError('Bạn không thể ứng tuyển công việc của chính mình.', 403);

    const application = await prisma.application.create({
      data: { jobId: job.id, workerId: req.auth!.id, matchScore: 0 }
    });
    res.status(201).json({ success: true, application });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return next(new AppError('Bạn đã ứng tuyển công việc này.', 409));
    }
    next(error);
  }
});
