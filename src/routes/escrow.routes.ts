import { Router, Request, Response } from 'express';
import { ProductionEscrowService } from '../modules/escrow/escrow.service';
import { GeofenceService } from '../modules/geofence/geofence.service';
import { repository } from '../repositories/in-memory.repository';
import { requireAuth, requireRole } from '../core/auth.middleware';

export const escrowRouter = Router();
escrowRouter.use(requireAuth);

escrowRouter.post('/escrow/lock', requireRole('POSTER'), (req: Request, res: Response) => {
  const { jobId, hours, hourlyRateVnd } = req.body;
  const sampleJob = repository.getSampleJob();
  const record = ProductionEscrowService.lockEscrow(
    jobId || sampleJob.id,
    req.auth!.id,
    hours || 3,
    hourlyRateVnd || 80000
  );

  res.json({
    success: true,
    escrow: {
      jobId: record.jobId,
      grossAmountVnd: record.grossAmountVnd.toString(),
      platformFeeVnd: record.platformFeeVnd.toString(),
      netWorkerPayoutVnd: record.netWorkerPayoutVnd.toString(),
      status: record.status,
      lockedAt: record.lockedAt
    }
  });
});

escrowRouter.post('/escrow/assign', requireRole('WORKER'), (req: Request, res: Response) => {
  const { jobId } = req.body;
  const sampleJob = repository.getSampleJob();
  const record = ProductionEscrowService.assignWorker(jobId || sampleJob.id, req.auth!.id);
  res.json({ success: true, status: record.status, workerId: record.workerId });
});

escrowRouter.post('/escrow/check-in', requireRole('WORKER'), (req: Request, res: Response) => {
  const { jobId, lat, lng, accuracyMeters } = req.body;
  if (![lat, lng, accuracyMeters].every((value) => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error('Tọa độ GPS và độ chính xác phải là số hợp lệ.');
  }
  const sampleJob = repository.getSampleJob();

  // Xác thực an ninh toạ độ Geofence 150m chống Fake GPS
  const verification = GeofenceService.validateCheckIn(
    {
      lat,
      lng,
      accuracyMeters,
      timestamp: Date.now()
    },
    sampleJob.location,
    undefined
  );

  const record = ProductionEscrowService.startJob(jobId || sampleJob.id, { lat, lng }, req.auth!.id);

  res.json({
    success: true,
    status: record.status,
    geofence: verification
  });
});

escrowRouter.post('/escrow/check-out', requireRole('WORKER'), (req: Request, res: Response) => {
  const { jobId, photoProofUrl } = req.body;
  const sampleJob = repository.getSampleJob();
  const record = ProductionEscrowService.submitProofOfWork(
    jobId || sampleJob.id,
    photoProofUrl,
    req.auth!.id
  );

  res.json({
    success: true,
    status: record.status,
    photoProofUrl: record.photoProofUrl,
    checkOutAt: record.checkOutAt
  });
});

escrowRouter.post('/escrow/release', requireRole('POSTER'), (req: Request, res: Response) => {
  const { jobId } = req.body;
  const sampleJob = repository.getSampleJob();
  const record = ProductionEscrowService.releasePayout(
    jobId || sampleJob.id,
    req.auth!.id
  );

  res.json({
    success: true,
    status: record.status,
    payoutAmountVnd: record.netWorkerPayoutVnd.toString(),
    platformFeeVnd: record.platformFeeVnd.toString(),
    releasedAt: record.releasedAt
  });
});
