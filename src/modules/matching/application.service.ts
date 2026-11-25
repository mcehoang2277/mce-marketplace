import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/app-error';
import { GeoUtils } from '../../core/utils/geo.utils';

export interface ApplicationWithWorker {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  workerKarma: number;
  isKycVerified: boolean;
  matchScore: number;
  distanceKm: number;
  status: string;
  notes?: string | null;
  createdAt: Date;
}

export class ApplicationService {
  /**
   * 1. Worker nộp hồ sơ ứng tuyển (Apply for Job)
   * Tự động tính Match Score (0 - 100) theo Khoảng cách, Kỹ năng và Điểm Karma
   */
  public static async applyForJob(
    jobId: string,
    workerId: string,
    notes?: string
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { applications: true }
    });

    if (!job) throw new AppError(`Không tìm thấy ca việc ${jobId}`, 404);
    if (job.status !== 'OPEN' && job.status !== 'DRAFT') {
      throw new AppError(`Không thể ứng tuyển: Ca việc đang ở trạng thái ${job.status}`, 400);
    }
    if (job.posterId === workerId) {
      throw new AppError('Bạn không thể tự ứng tuyển vào ca việc do chính mình đăng!', 400);
    }

    const worker = await prisma.user.findUnique({ where: { id: workerId } });
    if (!worker) throw new AppError(`Không tìm thấy hồ sơ người làm ${workerId}`, 404);

    // Kiểm tra xem đã nộp đơn trước đó chưa
    const existing = await prisma.application.findUnique({
      where: {
        jobId_workerId: { jobId, workerId }
      }
    });

    if (existing) {
      throw new AppError('Bạn đã nộp đơn ứng tuyển cho ca việc này rồi!', 409);
    }

    // TÍNH TOÁN MATCH SCORE THEO THUẬT TOÁN ĐA TIÊU CHÍ (MULTI-CRITERIA)
    let distanceKm = 1.5;
    if (worker.currentLat && worker.currentLng) {
      const distanceMeters = GeoUtils.calculateDistanceMeters(
        { lat: worker.currentLat, lng: worker.currentLng },
        { lat: job.lat, lng: job.lng }
      );
      distanceKm = Number((distanceMeters / 1000).toFixed(1));
    }

    // 1. Điểm khoảng cách (Max 40 điểm): Càng gần điểm càng cao
    // Với đặc thù vùng thưa dân: cự ly < 10km được tối đa 40 điểm, mỗi 5km tiếp theo trừ 3 điểm
    const distanceScore = Math.max(10, Math.min(40, 40 - (distanceKm > 10 ? (distanceKm - 10) * 0.6 : 0)));

    // 2. Điểm uy tín Karma (Max 35 điểm): 5.0 sao = 35 điểm
    const karmaScore = Math.min(35, (worker.karmaScore / 5.0) * 35);

    // 3. Điểm kỹ năng phù hợp (Max 25 điểm)
    let skillScore = 20;
    if (job.requiredSkills && job.requiredSkills.length > 0 && worker.skills.length > 0) {
      const matched = job.requiredSkills.filter(s => worker.skills.includes(s)).length;
      skillScore = Math.round((matched / job.requiredSkills.length) * 25);
    }

    const totalMatchScore = Math.min(100, Math.round(distanceScore + karmaScore + skillScore));

    const application = await prisma.application.create({
      data: {
        jobId,
        workerId,
        matchScore: totalMatchScore,
        status: 'APPLIED',
        notes: notes || 'Sẵn sàng nhận ca và làm việc đúng giờ cam kết.'
      }
    });

    return {
      applicationId: application.id,
      jobId,
      workerId,
      workerName: worker.fullName,
      matchScore: totalMatchScore,
      distanceKm,
      status: application.status,
      createdAt: application.createdAt
    };
  }

  /**
   * 2. Chủ việc xem danh sách ứng viên (Get Applicants for Job)
   * Sắp xếp ưu tiên ứng viên có Match Score cao nhất
   */
  public static async getJobApplicants(
    jobId: string,
    posterId: string
  ): Promise<ApplicationWithWorker[]> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        applications: {
          include: { worker: true },
          orderBy: { matchScore: 'desc' }
        }
      }
    });

    if (!job) throw new AppError(`Không tìm thấy ca việc ${jobId}`, 404);
    if (job.posterId !== posterId && posterId !== 'SYSTEM_ADMIN') {
      throw new AppError('Chỉ người đăng ca việc mới có quyền xem danh sách ứng viên!', 403);
    }

    return job.applications.map((app) => {
      let distanceKm = 2.0;
      if (app.worker.currentLat && app.worker.currentLng) {
        const dist = GeofenceUtils.calculateHaversineDistance(
          { lat: app.worker.currentLat, lng: app.worker.currentLng },
          { lat: job.lat, lng: job.lng }
        );
        distanceKm = Number((dist / 1000).toFixed(1));
      }

      return {
        id: app.id,
        jobId: app.jobId,
        workerId: app.workerId,
        workerName: app.worker.fullName,
        workerPhone: app.worker.phone,
        workerKarma: app.worker.karmaScore,
        isKycVerified: app.worker.isKycVerified,
        matchScore: app.matchScore,
        distanceKm,
        status: app.status,
        notes: app.notes,
        createdAt: app.createdAt
      };
    });
  }

  /**
   * 3. Chủ việc Xác nhận & Giao việc (Accept Applicant & Handover Job)
   * - Đổi trạng thái Application được chọn thành ACCEPTED
   * - Đổi các Application khác thành REJECTED
   * - Gán workerId vào Job và chuyển status sang ASSIGNED
   */
  public static async acceptApplicant(
    jobId: string,
    posterId: string,
    applicationId: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({
        where: { id: jobId },
        include: { escrowTransaction: true }
      });

      if (!job) throw new AppError(`Không tìm thấy ca việc ${jobId}`, 404);
      if (job.posterId !== posterId && posterId !== 'SYSTEM_ADMIN') {
        throw new AppError('Chỉ người đăng ca việc mới có quyền xác nhận ứng viên!', 403);
      }
      if (job.status === 'ASSIGNED' || job.status === 'IN_PROGRESS' || job.status === 'COMPLETED') {
        throw new AppError(`Ca việc này đã được giao cho người khác (Hiện tại: ${job.status})`, 409);
      }

      const targetApp = await tx.application.findUnique({
        where: { id: applicationId },
        include: { worker: true }
      });

      if (!targetApp || targetApp.jobId !== jobId) {
        throw new AppError('Đơn ứng tuyển không hợp lệ hoặc không thuộc về ca việc này!', 404);
      }

      // Cập nhật đơn được chọn
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'ACCEPTED',
          reviewedAt: new Date()
        }
      });

      // Từ chối các ứng viên khác để giải phóng lịch làm
      await tx.application.updateMany({
        where: {
          jobId,
          id: { not: applicationId }
        },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date()
        }
      });

      // Giao việc cho Worker
      const updatedJob = await tx.job.update({
        where: { id: jobId },
        data: {
          workerId: targetApp.workerId,
          status: 'ASSIGNED'
        }
      });

      return {
        success: true,
        jobId: updatedJob.id,
        jobTitle: updatedJob.title,
        status: updatedJob.status,
        assignedWorker: {
          id: targetApp.worker.id,
          name: targetApp.worker.fullName,
          phone: targetApp.worker.phone,
          matchScore: targetApp.matchScore
        },
        message: `Đã giao việc thành công cho ${targetApp.worker.fullName}! Hệ thống đã mở chế độ Check-in GPS cho Worker.`
      };
    });
  }
}
