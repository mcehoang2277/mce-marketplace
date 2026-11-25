import { Router, Request, Response, NextFunction } from 'express';
import { JobStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../core/database/prisma';
import { requireAuth, requireRole } from '../core/auth.middleware';
import { AppError } from '../core/errors/app-error';
import { repository } from '../repositories/in-memory.repository';
import { MatchingService } from '../modules/matching/matching.service';
import { ApplicationService } from '../modules/matching/application.service';
import { GeoUtils } from '../core/utils/geo.utils';
import { ENV } from '../config/env';
import { PostgresEscrowService } from '../modules/escrow/postgres-escrow.service';

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


const checkLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().max(1000),
  deviceInfo: z.string().max(300).optional()
});

jobRouter.get('/jobs/mine/completed', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        OR: [{ workerId: req.auth!.id }, { posterId: req.auth!.id }],
        status: JobStatus.COMPLETED
      },
      include: {
        poster: { select: { id: true, fullName: true } },
        worker: { select: { id: true, fullName: true } },
        reviews: { where: { reviewerId: req.auth!.id }, select: { id: true, rating: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 30
    });
    res.json({ success: true, jobs });
  } catch (error) {
    next(error);
  }
});

// Jobs relevant to the authenticated account; used by the active-shift screen.
jobRouter.get('/jobs/mine/active', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        OR: [{ workerId: req.auth!.id }, { posterId: req.auth!.id }],
        status: { in: [JobStatus.ASSIGNED, JobStatus.IN_PROGRESS, JobStatus.PENDING_REVIEW] }
      },
      include: {
        poster: { select: { id: true, fullName: true } },
        worker: { select: { id: true, fullName: true } },
        checkEvents: { orderBy: { recordedAt: 'asc' } },
        escrowTransaction: { select: { status: true, grossAmount: true } }
      },
      orderBy: { startTime: 'asc' },
      take: 20
    });
    res.json({ success: true, jobs });
  } catch (error) {
    next(error);
  }
});

jobRouter.post('/jobs/:jobId/check-in', requireAuth, requireRole('WORKER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = checkLocationSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Tọa độ hoặc độ chính xác GPS không hợp lệ.', 400);
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job) throw new AppError('Không tìm thấy ca việc.', 404);
    if (job.workerId !== req.auth!.id) throw new AppError('Bạn không được phân công ca việc này.', 403);
    if (job.status !== JobStatus.ASSIGNED) throw new AppError('Ca việc không ở trạng thái có thể check-in.', 409);
    const now = new Date();
    if (now.getTime() < job.startTime.getTime() - 60 * 60 * 1000 || now.getTime() > job.endTime.getTime() + 2 * 60 * 60 * 1000) {
      throw new AppError('Chỉ có thể check-in trong khoảng 60 phút trước giờ bắt đầu đến 2 giờ sau giờ kết thúc.', 400);
    }
    if (parsed.data.accuracyMeters > ENV.GPS_MAX_ALLOWED_ACCURACY_METERS) {
      throw new AppError('GPS chưa đủ chính xác. Hãy ra khu vực thoáng và thử lại.', 400);
    }
    const distanceMeters = GeoUtils.calculateDistanceMeters(
      { lat: parsed.data.lat, lng: parsed.data.lng },
      { lat: job.lat, lng: job.lng }
    );
    if (distanceMeters > ENV.GEOFENCE_RADIUS_METERS) {
      throw new AppError(`Bạn đang cách địa điểm làm việc ${Math.round(distanceMeters)}m; phạm vi cho phép là ${ENV.GEOFENCE_RADIUS_METERS}m.`, 400);
    }

    const event = await prisma.$transaction(async (tx) => {
      const changed = await tx.job.updateMany({
        where: { id: job.id, workerId: req.auth!.id, status: JobStatus.ASSIGNED },
        data: { status: JobStatus.IN_PROGRESS }
      });
      if (changed.count !== 1) throw new AppError('Ca việc đã được cập nhật ở thiết bị khác.', 409);
      return tx.checkEvent.create({
        data: {
          jobId: job.id,
          workerId: req.auth!.id,
          eventType: 'CHECK_IN',
          lat: parsed.data.lat,
          lng: parsed.data.lng,
          distanceMeters,
          accuracyMeters: parsed.data.accuracyMeters,
          deviceInfo: parsed.data.deviceInfo
        }
      });
    });
    res.status(201).json({ success: true, event, jobStatus: JobStatus.IN_PROGRESS });
  } catch (error) {
    next(error);
  }
});

jobRouter.post('/jobs/:jobId/check-out', requireAuth, requireRole('WORKER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = checkLocationSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Tọa độ hoặc độ chính xác GPS không hợp lệ.', 400);
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job) throw new AppError('Không tìm thấy ca việc.', 404);
    if (job.workerId !== req.auth!.id) throw new AppError('Bạn không được phân công ca việc này.', 403);
    if (job.status !== JobStatus.IN_PROGRESS) throw new AppError('Cần check-in thành công trước khi check-out.', 409);
    if (parsed.data.accuracyMeters > ENV.GPS_MAX_ALLOWED_ACCURACY_METERS) {
      throw new AppError('GPS chưa đủ chính xác. Hãy thử lại ở khu vực thoáng.', 400);
    }
    const distanceMeters = GeoUtils.calculateDistanceMeters(
      { lat: parsed.data.lat, lng: parsed.data.lng },
      { lat: job.lat, lng: job.lng }
    );
    if (distanceMeters > ENV.GEOFENCE_RADIUS_METERS) {
      throw new AppError(`Bạn đang cách địa điểm làm việc ${Math.round(distanceMeters)}m; phạm vi cho phép là ${ENV.GEOFENCE_RADIUS_METERS}m.`, 400);
    }

    const event = await prisma.$transaction(async (tx) => {
      const checkIn = await tx.checkEvent.findFirst({
        where: { jobId: job.id, workerId: req.auth!.id, eventType: 'CHECK_IN' }
      });
      if (!checkIn) throw new AppError('Không tìm thấy lượt check-in hợp lệ.', 409);
      const changed = await tx.job.updateMany({
        where: { id: job.id, workerId: req.auth!.id, status: JobStatus.IN_PROGRESS },
        data: { status: JobStatus.PENDING_REVIEW }
      });
      if (changed.count !== 1) throw new AppError('Ca việc đã được cập nhật ở thiết bị khác.', 409);
      return tx.checkEvent.create({
        data: {
          jobId: job.id,
          workerId: req.auth!.id,
          eventType: 'CHECK_OUT',
          lat: parsed.data.lat,
          lng: parsed.data.lng,
          distanceMeters,
          accuracyMeters: parsed.data.accuracyMeters,
          deviceInfo: parsed.data.deviceInfo
        }
      });
    });
    res.status(201).json({ success: true, event, jobStatus: JobStatus.PENDING_REVIEW, message: 'Đã gửi ca làm để người đăng nghiệm thu.' });
  } catch (error) {
    next(error);
  }
});

jobRouter.post('/jobs/:jobId/approve-completion', requireAuth, requireRole('POSTER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await PostgresEscrowService.releaseEscrowTx(req.params.jobId, req.auth!.id);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

jobRouter.post('/jobs/:jobId/reviews', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).optional()
    }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Đánh giá phải từ 1 đến 5 sao.', 400);
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job || job.status !== JobStatus.COMPLETED || !job.workerId) {
      throw new AppError('Chỉ có thể đánh giá sau khi ca việc hoàn thành.', 409);
    }
    let revieweeId: string;
    if (req.auth!.id === job.posterId) revieweeId = job.workerId;
    else if (req.auth!.id === job.workerId) revieweeId = job.posterId;
    else throw new AppError('Bạn không phải người tham gia ca việc này.', 403);

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          jobId: job.id,
          reviewerId: req.auth!.id,
          revieweeId,
          rating: parsed.data.rating,
          comment: parsed.data.comment || null
        }
      });
      const aggregate = await tx.review.aggregate({
        where: { revieweeId },
        _avg: { rating: true }
      });
      await tx.user.update({
        where: { id: revieweeId },
        data: { karmaScore: aggregate._avg.rating ?? 5 }
      });
      return created;
    });
    res.status(201).json({ success: true, review });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return next(new AppError('Bạn đã đánh giá ca việc này rồi.', 409));
    }
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
