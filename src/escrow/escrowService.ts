// Legacy Adapter - Re-exports from unified ProductionEscrowService
import { Coordinates, EscrowRecord, EscrowState } from '../types';
import { ProductionEscrowService, EscrowStatus } from '../modules/escrow/escrow.service';
import { GeoUtils } from '../core/utils/geo.utils';

export class EscrowService {
  public static lockEscrow(
    jobId: string,
    posterId: string,
    estimatedHours: number,
    hourlyRateVnd: number,
    platformFeeRate: number = 0.08
  ): EscrowRecord {
    const rec = ProductionEscrowService.lockEscrow(jobId, posterId, estimatedHours, hourlyRateVnd);
    return {
      jobId: rec.jobId,
      posterId: rec.posterId,
      grossAmountVnd: Number(rec.grossAmountVnd),
      platformFeeRate,
      platformFeeVnd: Number(rec.platformFeeVnd),
      netWorkerPayoutVnd: Number(rec.netWorkerPayoutVnd),
      state: EscrowState.LOCKED
    };
  }

  public static assignWorker(jobId: string, workerId: string): EscrowRecord {
    const rec = ProductionEscrowService.assignWorker(jobId, workerId);
    return this.mapToLegacy(rec);
  }

  public static checkIn(
    jobId: string,
    workerCoords: Coordinates,
    jobCoords: Coordinates,
    maxDistanceMeters: number = 150
  ): { success: boolean; distanceMeters: number; message: string } {
    const distanceMeters = GeoUtils.calculateDistanceMeters(workerCoords, jobCoords);
    if (distanceMeters > maxDistanceMeters) {
      return {
        success: false,
        distanceMeters,
        message: `Bạn đang cách điểm làm ${distanceMeters}m (Vượt quá bán kính cho phép ${maxDistanceMeters}m).`
      };
    }

    ProductionEscrowService.startJob(jobId, workerCoords);
    return {
      success: true,
      distanceMeters,
      message: `Check-in thành công tại vị trí công việc (${distanceMeters}m sai số). Bắt đầu tính giờ làm.`
    };
  }

  public static checkOut(jobId: string, photoProofUrl: string): EscrowRecord {
    const rec = ProductionEscrowService.submitProofOfWork(jobId, photoProofUrl);
    return this.mapToLegacy(rec);
  }

  public static releaseEscrow(jobId: string): EscrowRecord {
    const rec = ProductionEscrowService.releasePayout(jobId, 'SYSTEM_ADMIN');
    return this.mapToLegacy(rec);
  }

  public static fileDispute(jobId: string, reason: string): EscrowRecord {
    const rec = ProductionEscrowService.fileDispute(jobId, 'SYSTEM_ADMIN', reason);
    return this.mapToLegacy(rec);
  }

  public static getEscrow(jobId: string): EscrowRecord | undefined {
    const rec = ProductionEscrowService.getEscrow(jobId);
    return rec ? this.mapToLegacy(rec) : undefined;
  }

  private static mapToLegacy(rec: any): EscrowRecord {
    return {
      jobId: rec.jobId,
      posterId: rec.posterId,
      workerId: rec.workerId,
      grossAmountVnd: Number(rec.grossAmountVnd),
      platformFeeRate: 0.08,
      platformFeeVnd: Number(rec.platformFeeVnd),
      netWorkerPayoutVnd: Number(rec.netWorkerPayoutVnd),
      state: rec.status as EscrowState,
      checkInAt: rec.checkInAt,
      checkOutAt: rec.checkOutAt,
      checkInCoords: rec.checkInCoords,
      photoProofUrl: rec.photoProofUrl,
      disputeReason: rec.disputeReason
    };
  }
}
