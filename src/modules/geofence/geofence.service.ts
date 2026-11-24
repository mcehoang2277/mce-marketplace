import { Coordinates } from '../../types';
import { ENV } from '../../config/env';
import { AppError } from '../../core/errors/app-error';
import { GeoUtils } from '../../core/utils/geo.utils';

export interface GpsPingRecord {
  lat: number;
  lng: number;
  timestamp: number;
  accuracyMeters: number;
}

export class GeofenceService {
  /**
   * Tính khoảng cách Haversine chuẩn (mét) qua GeoUtils
   */
  public static calculateDistanceMeters(coord1: Coordinates, coord2: Coordinates): number {
    return GeoUtils.calculateDistanceMeters(coord1, coord2);
  }

  /**
   * Bộ lọc chống gian lận Check-in GPS 3 tầng:
   * 1. Kiểm tra độ chuẩn xác của chip GPS vệ tinh (Accuracy <= 50m)
   * 2. Kiểm tra bán kính Geofence công việc (Mặc định <= 150m)
   * 3. Kiểm tra vận tốc di chuyển bất thường (Anti Teleportation / Fake GPS > 120km/h)
   */
  public static validateCheckIn(
    workerPing: GpsPingRecord,
    jobLocation: Coordinates,
    lastPing?: GpsPingRecord,
    maxDistanceMeters: number = ENV.GEOFENCE_RADIUS_METERS
  ): { valid: boolean; distanceMeters: number; message: string } {
    // 1. TẦNG 1: Kiểm tra độ chính xác phần cứng
    if (workerPing.accuracyMeters > ENV.GPS_MAX_ALLOWED_ACCURACY_METERS) {
      throw new AppError(
        `Tín hiệu GPS không đủ tin cậy (Sai số ${workerPing.accuracyMeters}m > ngưỡng ${ENV.GPS_MAX_ALLOWED_ACCURACY_METERS}m). Vui lòng ra nơi thông thoáng hoặc bật định vị độ chính xác cao.`,
        422
      );
    }

    // 2. TẦNG 2: Kiểm tra khoảng cách tới điểm làm việc
    const distanceMeters = GeoUtils.calculateDistanceMeters(
      { lat: workerPing.lat, lng: workerPing.lng },
      jobLocation
    );

    if (distanceMeters > maxDistanceMeters) {
      throw new AppError(
        `Check-in thất bại: Bạn đang cách điểm làm việc ${distanceMeters}m (vượt quá bán kính cho phép ${maxDistanceMeters}m).`,
        400
      );
    }

    // 3. TẦNG 3: Kiểm tra vận tốc bất thường nếu có ping trước đó
    if (lastPing) {
      const timeDiffSeconds = Math.max(1, (workerPing.timestamp - lastPing.timestamp) / 1000);
      const movedMeters = GeoUtils.calculateDistanceMeters(
        { lat: workerPing.lat, lng: workerPing.lng },
        { lat: lastPing.lat, lng: lastPing.lng }
      );
      const speedKmH = (movedMeters / timeDiffSeconds) * 3.6;

      if (speedKmH > ENV.MAX_SPEED_KM_PER_HOUR) {
        throw new AppError(
          `Cảnh báo an ninh: Phát hiện tốc độ di chuyển bất thường (${Math.round(speedKmH)} km/h). Nghi vấn sử dụng ứng dụng Fake GPS / Mock Location.`,
          403
        );
      }
    }

    return {
      valid: true,
      distanceMeters,
      message: `Xác thực vị trí thành công (Cách điểm làm việc ${distanceMeters}m). Bắt đầu tính giờ làm.`
    };
  }
}
