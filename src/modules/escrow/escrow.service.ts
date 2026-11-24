import { Coordinates } from '../../types';
import { AppError } from '../../core/errors/app-error';

export enum EscrowStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  LOCKED = 'LOCKED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
  REFUNDED = 'REFUNDED'
}

export interface EscrowAccountRecord {
  jobId: string;
  posterId: string;
  workerId?: string;
  grossAmountVnd: bigint;
  platformFeeRateNumerator: bigint;   // 8n
  platformFeeRateDenominator: bigint; // 100n
  platformFeeVnd: bigint;
  netWorkerPayoutVnd: bigint;
  status: EscrowStatus;
  lockedAt?: Date;
  checkInAt?: Date;
  checkOutAt?: Date;
  releasedAt?: Date;
  checkInCoords?: Coordinates;
  photoProofUrl?: string;
  disputeReason?: string;
}

export interface EscrowPolicyConfig {
  feeRateNumerator: bigint;
  feeRateDenominator: bigint;
  isPromoActive: boolean;
  promoName: string;
}

export class ProductionEscrowService {
  private static ledger: Map<string, EscrowAccountRecord> = new Map();

  // CHÍNH SÁCH 3 THÁNG ĐẦU: MIỄN 100% PHÍ SÀN (0%) ĐỂ ƯU TIÊN MỞ RỘNG TĂNG TRƯỞNG
  public static policyConfig: EscrowPolicyConfig = {
    feeRateNumerator: 0n, // 0% Phí sàn trong 90 ngày đầu
    feeRateDenominator: 100n,
    isPromoActive: true,
    promoName: 'LAUNCH_ZERO_FEE_90_DAYS'
  };

  public static setFeePolicy(numerator: bigint, denominator: bigint = 100n, promoName = 'CUSTOM'): void {
    this.policyConfig = {
      feeRateNumerator: numerator,
      feeRateDenominator: denominator,
      isPromoActive: numerator === 0n,
      promoName
    };
  }

  /**
   * 1. Khóa tiền ký quỹ (Lock Escrow) với tính toán BigInt chính xác 100%
   */
  public static lockEscrow(
    jobId: string,
    posterId: string,
    hours: number,
    hourlyRateVnd: number
  ): EscrowAccountRecord {
    const grossAmountVnd = BigInt(Math.round(hours * hourlyRateVnd));
    const platformFeeRateNumerator = this.policyConfig.feeRateNumerator;
    const platformFeeRateDenominator = this.policyConfig.feeRateDenominator;
    const platformFeeVnd = (grossAmountVnd * platformFeeRateNumerator) / platformFeeRateDenominator;
    const netWorkerPayoutVnd = grossAmountVnd - platformFeeVnd;

    const record: EscrowAccountRecord = {
      jobId,
      posterId,
      grossAmountVnd,
      platformFeeRateNumerator,
      platformFeeRateDenominator,
      platformFeeVnd,
      netWorkerPayoutVnd,
      status: EscrowStatus.LOCKED,
      lockedAt: new Date()
    };

    this.ledger.set(jobId, record);
    return record;
  }

  /**
   * 2. Gán Worker sau khi ký hợp đồng nhiệm vụ
   */
  public static assignWorker(jobId: string, workerId: string): EscrowAccountRecord {
    const escrow = this.getOrThrow(jobId);
    if (escrow.status !== EscrowStatus.LOCKED) {
      throw new AppError(`Không thể nhận việc: Ca việc không ở trạng thái LOCKED (Hiện tại: ${escrow.status})`, 409);
    }
    if (escrow.workerId) {
      throw new AppError('Công việc này đã được một ứng viên khác nhận trước!', 409);
    }

    escrow.workerId = workerId;
    return escrow;
  }

  /**
   * 3. Bắt đầu ca việc sau khi Check-in Geofence thành công
   */
  public static startJob(jobId: string, workerCoords: Coordinates): EscrowAccountRecord {
    const escrow = this.getOrThrow(jobId);
    if (escrow.status !== EscrowStatus.LOCKED) {
      throw new AppError(`Không thể bắt đầu ca làm: Trạng thái hiện tại là ${escrow.status}`, 400);
    }

    escrow.status = EscrowStatus.IN_PROGRESS;
    escrow.checkInAt = new Date();
    escrow.checkInCoords = workerCoords;
    return escrow;
  }

  /**
   * 4. Check-out và nộp bằng chứng công việc
   */
  public static submitProofOfWork(jobId: string, photoProofUrl: string): EscrowAccountRecord {
    const escrow = this.getOrThrow(jobId);
    if (escrow.status !== EscrowStatus.IN_PROGRESS) {
      throw new AppError(`Không thể nộp bằng chứng: Ca làm không ở trạng thái IN_PROGRESS (Hiện tại: ${escrow.status})`, 400);
    }
    if (!photoProofUrl || photoProofUrl.trim().length === 0) {
      throw new AppError('Bắt buộc phải tải lên ảnh chụp bằng chứng hoàn thành ca làm.', 422);
    }

    escrow.status = EscrowStatus.PENDING_REVIEW;
    escrow.checkOutAt = new Date();
    escrow.photoProofUrl = photoProofUrl;
    return escrow;
  }

  /**
   * 5. Phê duyệt hoàn thành & Giải ngân về ví Worker
   */
  public static releasePayout(jobId: string, approverId: string): EscrowAccountRecord {
    const escrow = this.getOrThrow(jobId);
    if (escrow.status !== EscrowStatus.PENDING_REVIEW) {
      throw new AppError(`Không thể giải ngân: Ca làm chưa được check-out (Hiện tại: ${escrow.status})`, 400);
    }
    if (escrow.posterId !== approverId && approverId !== 'SYSTEM_ADMIN') {
      throw new AppError('Chỉ người đăng việc hoặc quản trị viên hệ thống mới có quyền giải ngân.', 403);
    }

    escrow.status = EscrowStatus.COMPLETED;
    escrow.releasedAt = new Date();
    return escrow;
  }

  /**
   * 6. Khởi tạo khiếu nại (Dispute)
   */
  public static fileDispute(jobId: string, initiatorId: string, reason: string): EscrowAccountRecord {
    const escrow = this.getOrThrow(jobId);
    if (escrow.status !== EscrowStatus.PENDING_REVIEW && escrow.status !== EscrowStatus.IN_PROGRESS) {
      throw new AppError(`Không thể khiếu nại ở trạng thái ${escrow.status}`, 400);
    }

    escrow.status = EscrowStatus.DISPUTED;
    escrow.disputeReason = reason;
    return escrow;
  }

  public static getEscrow(jobId: string): EscrowAccountRecord | undefined {
    return this.ledger.get(jobId);
  }

  private static getOrThrow(jobId: string): EscrowAccountRecord {
    const record = this.ledger.get(jobId);
    if (!record) {
      throw new AppError(`Không tìm thấy hồ sơ Escrow cho công việc: ${jobId}`, 404);
    }
    return record;
  }
}
