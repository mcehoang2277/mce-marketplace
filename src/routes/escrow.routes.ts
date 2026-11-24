import { Router, Request, Response } from 'express';
import { ProductionEscrowService } from '../modules/escrow/escrow.service';
import { GeofenceService } from '../modules/geofence/geofence.service';
import { repository } from '../repositories/in-memory.repository';

export const escrowRouter = Router();

escrowRouter.post('/escrow/lock', (req: Request, res: Response) => {
  const { jobId, posterId, hours, hourlyRateVnd } = req.body;
  const sampleJob = repository.getSampleJob();
  const record = ProductionEscrowService.lockEscrow(
    jobId || sampleJob.id,
    posterId || 'poster-001',
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

escrowRouter.post('/escrow/assign', (req: Request, res: Response) => {
  const { jobId, workerId } = req.body;
  const sampleJob = repository.getSampleJob();
  const record = ProductionEscrowService.assignWorker(jobId || sampleJob.id, workerId || 'worker-001');
  res.json({ success: true, status: record.status, workerId: record.workerId });
});

escrowRouter.post('/escrow/check-in', (req: Request, res: Response) => {
  const { jobId, lat, lng, accuracyMeters, lastPing } = req.body;
  const sampleJob = repository.getSampleJob();

  // Xác thực an ninh toạ độ Geofence 150m chống Fake GPS
  const verification = GeofenceService.validateCheckIn(
    {
      lat: parseFloat(lat || '21.0286'),
      lng: parseFloat(lng || '105.8545'),
      accuracyMeters: parseFloat(accuracyMeters || '15'),
      timestamp: Date.now()
    },
    sampleJob.location,
    lastPing
  );

  const record = ProductionEscrowService.startJob(jobId || sampleJob.id, { lat, lng });

  res.json({
    success: true,
    status: record.status,
    geofence: verification
  });
});

escrowRouter.post('/escrow/check-out', (req: Request, res: Response) => {
  const { jobId, photoProofUrl } = req.body;
  const sampleJob = repository.getSampleJob();
  const record = ProductionEscrowService.submitProofOfWork(
    jobId || sampleJob.id,
    photoProofUrl || 'https://cdn.mce.vn/proofs/job-hanoi-001-done.jpg'
  );

  res.json({
    success: true,
    status: record.status,
    photoProofUrl: record.photoProofUrl,
    checkOutAt: record.checkOutAt
  });
});

escrowRouter.post('/escrow/release', (req: Request, res: Response) => {
  const { jobId, approverId } = req.body;
  const sampleJob = repository.getSampleJob();
  const record = ProductionEscrowService.releasePayout(
    jobId || sampleJob.id,
    approverId || 'poster-001'
  );

  res.json({
    success: true,
    status: record.status,
    payoutAmountVnd: record.netWorkerPayoutVnd.toString(),
    platformFeeVnd: record.platformFeeVnd.toString(),
    releasedAt: record.releasedAt
  });
});
