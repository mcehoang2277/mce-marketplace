import { Router, Request, Response, NextFunction } from 'express';
import { JobStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../core/database/prisma';
import { requireAuth, requireRole } from '../core/auth.middleware';
import { AppError } from '../core/errors/app-error';
import { repository } from '../repositories/in-memory.repository';
import { MatchingService } from '../modules/matching/matching.service';
import { ApplicationService } from '../modules/matching/application.service';

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
    const schema = z.object({ notes: z.string().trim().max(1000).optional() });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) throw new AppError('Nội dung ứng tuyển không hợp lệ.', 400);
    const application = await ApplicationService.applyForJob(req.params.jobId, req.auth!.id, parsed.data.notes);
    res.status(201).json({ success: true, application });
  } catch (error) {
    next(error);
  }
});

jobRouter.get('/jobs/:jobId/applications', requireAuth, requireRole('POSTER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applications = await ApplicationService.getJobApplicants(req.params.jobId, req.auth!.id);
    res.json({ success: true, applications });
  } catch (error) {
    next(error);
  }
});

jobRouter.post('/jobs/:jobId/applications/:applicationId/accept', requireAuth, requireRole('POSTER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ApplicationService.acceptApplicant(req.params.jobId, req.auth!.id, req.params.applicationId);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

// Legacy demo endpoints remain available for comparison; they do not read production job data.
jobRouter.get('/candidates', requireAuth, async (_req: Request, res: Response) => {
  const candidates = await repository.findAll();
  res.json({
    success: true,
    demo: true,
    total: candidates.length,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.fullName,
      phone: c.phone,
      location: c.location,
      skills: c.skills,
      karmaScore: c.karmaScore,
      desiredRateVnd: c.desiredMinHourlyRateVnd
    }))
  });
});

jobRouter.get('/jobs/match', async (_req: Request, res: Response) => {
  const candidates = await repository.findAll();
  const sampleJob = repository.getSampleJob();
  const matches = MatchingService.rankCandidates(candidates, sampleJob);
  res.json({
    success: true,
    demo: true,
    jobId: sampleJob.id,
    jobTitle: sampleJob.title,
    matches
  });
});

jobRouter.get('/jobs/benchmark', (req: Request, res: Response) => {
  const rate = parseInt(req.query.rate as string, 10) || 80000;
  const benchmark = MatchingService.calculatePriceBenchmark(rate);
  res.json({ success: true, benchmark });
});
