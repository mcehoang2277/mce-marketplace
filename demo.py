"""
MCE HYPERLOCAL TIME MARKETPLACE — CORE SIMULATION (PYTHON ZERO-DEPENDENCY)
Chạy trực tiếp bằng lệnh: python demo.py
Không cần cài thêm bất kỳ thư viện ngoài nào (100% Thư viện chuẩn Python)
"""

import math
from datetime import datetime, time
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Tuple


# ==============================================================================
# 1. KHAI BÁO KIỂU DỮ LIỆU & ĐỊNH NGHĨA
# ==============================================================================

@dataclass
class Coordinates:
    lat: float
    lng: float


@dataclass
class TimeSlot:
    start: datetime
    end: datetime


@dataclass
class WorkerCandidate:
    id: str
    full_name: str
    phone: str
    location: Coordinates
    free_slots: List[TimeSlot]
    skills: List[str]
    karma_score: float         # 0.0 - 5.0
    completion_rate: float     # 0.0 - 1.0 (vd: 0.98 = 98% hoàn thành không hủy)
    desired_min_rate_vnd: int  # Mức thù lao mong muốn tối thiểu (VNĐ/giờ)
    is_kyc_verified: bool = True


@dataclass
class JobRequirement:
    id: str
    title: str
    category: str
    slot: TimeSlot
    location: Coordinates
    address_text: str
    max_radius_km: float
    hourly_rate_vnd: int
    required_skills: List[str]
    min_karma_score: float = 4.0


class EscrowState(Enum):
    PENDING = "PENDING"
    LOCKED = "LOCKED"
    IN_PROGRESS = "IN_PROGRESS"
    PENDING_REVIEW = "PENDING_REVIEW"
    COMPLETED = "COMPLETED"
    DISPUTED = "DISPUTED"
    REFUNDED = "REFUNDED"


@dataclass
class EscrowRecord:
    job_id: str
    poster_id: str
    gross_amount_vnd: int
    platform_fee_rate: float
    platform_fee_vnd: int
    net_worker_payout_vnd: int
    state: EscrowState
    worker_id: Optional[str] = None
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    photo_proof_url: Optional[str] = None


# ==============================================================================
# 2. THUẬT TOÁN MATCH ENGINE (LỌC NHANH & CHẤM ĐIỂM ĐA TIÊU CHÍ)
# ==============================================================================

class MatchingEngine:
    @staticmethod
    def calculate_haversine_distance_km(coord1: Coordinates, coord2: Coordinates) -> float:
        """Tính khoảng cách Haversine giữa 2 toạ độ GPS (đơn vị: km)"""
        R = 6371.0  # Bán kính trái đất (km)
        d_lat = math.radians(coord2.lat - coord1.lat)
        d_lng = math.radians(coord2.lng - coord1.lng)
        
        a = (math.sin(d_lat / 2) ** 2 +
             math.cos(math.radians(coord1.lat)) * math.cos(math.radians(coord2.lat)) *
             math.sin(d_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    @staticmethod
    def is_time_slot_covered(worker_slots: List[TimeSlot], job_slot: TimeSlot) -> bool:
        """Kiểm tra ứng viên có khung giờ rảnh bao trọn khung giờ ca việc hay không"""
        for slot in worker_slots:
            if slot.start <= job_slot.start and slot.end >= job_slot.end:
                return True
        return False

    @classmethod
    def fast_filter(cls, candidate: WorkerCandidate, job: JobRequirement) -> Tuple[bool, Optional[str]]:
        """TẦNG 1: LỌC NHANH (Loại bỏ các ứng viên không khả thi)"""
        if candidate.karma_score < job.min_karma_score:
            return False, f"Điểm uy tín Karma {candidate.karma_score} < yêu cầu tối thiểu {job.min_karma_score}"
            
        dist_km = cls.calculate_haversine_distance_km(candidate.location, job.location)
        if dist_km > job.max_radius_km:
            return False, f"Khoảng cách {dist_km} km vượt quá bán kính tối đa {job.max_radius_km} km"
            
        if not cls.is_time_slot_covered(candidate.free_slots, job.slot):
            return False, "Không có khung giờ rảnh khớp với ca làm việc"
            
        return True, None

    @classmethod
    def evaluate_candidate(cls, candidate: WorkerCandidate, job: JobRequirement) -> Dict:
        """TẦNG 2: CHẤM ĐIỂM CHI TIẾT (MATCH SCORE 0 - 100)"""
        dist_km = cls.calculate_haversine_distance_km(candidate.location, job.location)
        passed, reason = cls.fast_filter(candidate, job)
        
        if not passed:
            return {
                "candidate": candidate,
                "distance_km": dist_km,
                "travel_score": 0,
                "skill_score": 0,
                "reputation_score": 0,
                "price_score": 0,
                "total_score": 0.0,
                "is_eligible": False,
                "rejection_reason": reason
            }

        # 1. Travel Score (Trọng số 30%): Khoảng cách càng gần điểm càng cao
        travel_score = max(0, min(100, round(100 * (1 - dist_km / job.max_radius_km))))

        # 2. Time Score (Trọng số 25%): Đã bao trọn khung giờ ca việc
        time_score = 100

        # 3. Skill Score (Trọng số 20%): Tỷ lệ khớp kỹ năng bắt buộc
        matched_skills = [s for s in job.required_skills if s in candidate.skills]
        skill_score = round((len(matched_skills) / len(job.required_skills)) * 100) if job.required_skills else 100

        # 4. Reputation Score (Trọng số 15%): Karma (thang 5) và tỷ lệ hoàn tất
        karma_part = (candidate.karma_score / 5.0) * 100
        completion_part = candidate.completion_rate * 100
        reputation_score = round(karma_part * 0.5 + completion_part * 0.5)

        # 5. Price Affinity (Trọng số 10%): Thù lao công việc so với mong muốn của Worker
        if job.hourly_rate_vnd >= candidate.desired_min_rate_vnd:
            price_score = 100
        else:
            ratio = job.hourly_rate_vnd / candidate.desired_min_rate_vnd
            price_score = max(0, round(ratio * 100))

        # TỔNG MATCH SCORE = 30% Travel + 25% Time + 20% Skill + 15% Reputation + 10% Price
        total_score = round(
            travel_score * 0.30 +
            time_score * 0.25 +
            skill_score * 0.20 +
            reputation_score * 0.15 +
            price_score * 0.10,
            1
        )

        return {
            "candidate": candidate,
            "distance_km": dist_km,
            "travel_score": travel_score,
            "skill_score": skill_score,
            "reputation_score": reputation_score,
            "price_score": price_score,
            "total_score": total_score,
            "is_eligible": True
        }

    @classmethod
    def rank_candidates(cls, candidates: List[WorkerCandidate], job: JobRequirement, limit: int = 5) -> List[Dict]:
        scored = [cls.evaluate_candidate(c, job) for c in candidates]
        eligible = [s for s in scored if s["is_eligible"]]
        return sorted(eligible, key=lambda x: x["total_score"], reverse=True)[:limit]


# ==============================================================================
# 3. QUẢN LÝ DÒNG TIỀN KÝ QUỸ (ESCROW SERVICE)
# ==============================================================================

class EscrowService:
    _db: Dict[str, EscrowRecord] = {}

    @classmethod
    def lock_escrow(cls, job_id: str, poster_id: str, hours: float, rate_vnd: int, fee_rate: float = 0.08) -> EscrowRecord:
        gross = round(hours * rate_vnd)
        fee = round(gross * fee_rate)
        net = gross - fee

        record = EscrowRecord(
            job_id=job_id,
            poster_id=poster_id,
            gross_amount_vnd=gross,
            platform_fee_rate=fee_rate,
            platform_fee_vnd=fee,
            net_worker_payout_vnd=net,
            state=EscrowState.LOCKED
        )
        cls._db[job_id] = record
        return record

    @classmethod
    def assign_worker(cls, job_id: str, worker_id: str):
        record = cls._db[job_id]
        record.worker_id = worker_id

    @classmethod
    def check_in(cls, job_id: str, worker_coords: Coordinates, job_coords: Coordinates, max_dist_m: int = 150) -> Tuple[bool, str]:
        record = cls._db[job_id]
        dist_km = MatchingEngine.calculate_haversine_distance_km(worker_coords, job_coords)
        dist_m = round(dist_km * 1000)

        if dist_m > max_dist_m:
            return False, f"Bạn đang cách điểm làm việc {dist_m}m (vượt quá bán kính cho phép {max_dist_m}m)."

        record.state = EscrowState.IN_PROGRESS
        record.check_in_at = datetime.now()
        return True, f"Check-in thành công (sai số {dist_m}m). Bắt đầu tính giờ làm!"

    @classmethod
    def check_out(cls, job_id: str, photo_url: str):
        record = cls._db[job_id]
        record.state = EscrowState.PENDING_REVIEW
        record.check_out_at = datetime.now()
        record.photo_proof_url = photo_url

    @classmethod
    def release_escrow(cls, job_id: str) -> EscrowRecord:
        record = cls._db[job_id]
        record.state = EscrowState.COMPLETED
        return record


# ==============================================================================
# 4. CHƯƠNG TRÌNH MÔ PHỎNG (MAIN SIMULATION)
# ==============================================================================

def main():
    print("=" * 75)
    print("🚀 MCE HYPERLOCAL TIME MARKETPLACE — CHẠY MÔ PHỎNG (PYTHON NATIVE)")
    print("=" * 75)

    now = datetime.now()
    start_job = datetime(now.year, now.month, now.day, 14, 0)
    end_job = datetime(now.year, now.month, now.day, 17, 0)

    # 1. Tạo Job
    job = JobRequirement(
        id="job-hanoi-001",
        title="Phụ đóng gói 300 kiện hàng shopee",
        category="Kho vận & Đóng gói",
        slot=TimeSlot(start_job, end_job),
        location=Coordinates(lat=21.028511, lng=105.854444), # Hoàn Kiếm, Hà Nội
        address_text="Số 12 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội",
        max_radius_km=6.0,
        hourly_rate_vnd=80000,
        required_skills=["dong_goi", "can_than"],
        min_karma_score=4.0
    )

    print("\n📌 [BƯỚC 1] CÔNG VIỆC CẦN TUYỂN GẤP:")
    print(f"   - Tên công việc: {job.title}")
    print(f"   - Khung giờ: 14:00 - 17:00 (3 tiếng)")
    print(f"   - Mức thù lao: {job.hourly_rate_vnd:,} VNĐ/giờ")
    print(f"   - Địa điểm: {job.address_text}")
    print(f"   - Bán kính quét: {job.max_radius_km} km")
    print(f"   - Kỹ năng yêu cầu: {job.required_skills}")

    # 2. Dữ liệu ứng viên
    candidates = [
        WorkerCandidate(
            id="worker-001",
            full_name="Nguyễn Văn An (Sinh viên)",
            phone="0981234567",
            location=Coordinates(lat=21.0175, lng=105.8423), # ~1.8 km
            free_slots=[TimeSlot(datetime(now.year, now.month, now.day, 13, 0), datetime(now.year, now.month, now.day, 18, 0))],
            skills=["dong_goi", "can_than", "xe_may"],
            karma_score=4.9,
            completion_rate=0.98,
            desired_min_rate_vnd=75000
        ),
        WorkerCandidate(
            id="worker-002",
            full_name="Trần Thị Bình (Tìm việc linh hoạt)",
            phone="0977654321",
            location=Coordinates(lat=21.0501, lng=105.8123), # ~4.9 km
            free_slots=[TimeSlot(datetime(now.year, now.month, now.day, 13, 30), datetime(now.year, now.month, now.day, 19, 0))],
            skills=["dong_goi"],
            karma_score=4.3,
            completion_rate=0.90,
            desired_min_rate_vnd=85000
        ),
        WorkerCandidate(
            id="worker-003",
            full_name="Lê Văn Cường (Gần nhưng bận)",
            phone="0912345999",
            location=Coordinates(lat=21.0290, lng=105.8550), # ~0.1 km
            free_slots=[TimeSlot(datetime(now.year, now.month, now.day, 15, 30), datetime(now.year, now.month, now.day, 20, 0))],
            skills=["dong_goi", "can_than"],
            karma_score=4.8,
            completion_rate=0.95,
            desired_min_rate_vnd=70000
        ),
        WorkerCandidate(
            id="worker-004",
            full_name="Phạm Đức Dũng (Ở quá xa)",
            phone="0933221100",
            location=Coordinates(lat=20.9723, lng=105.8621), # ~6.5 km > 6.0 km
            free_slots=[TimeSlot(datetime(now.year, now.month, now.day, 12, 0), datetime(now.year, now.month, now.day, 20, 0))],
            skills=["dong_goi", "can_than"],
            karma_score=5.0,
            completion_rate=1.0,
            desired_min_rate_vnd=70000
        )
    ]

    print(f"\n🔍 [BƯỚC 2] MATCH ENGINE ĐANG QUÉT {len(candidates)} ỨNG VIÊN ĐANG ONLINE...")
    ranked = MatchingEngine.rank_candidates(candidates, job)

    print("\n🏆 KẾT QUẢ XẾP HẠNG ỨNG VIÊN PHÙ HỢP NHẤT:")
    for idx, item in enumerate(ranked, 1):
        c = item["candidate"]
        print(f"   #{idx}: {c.full_name}")
        print(f"       - TỔNG ĐIỂM MATCH SCORE: {item['total_score']} / 100")
        print(f"       - Khoảng cách: {item['distance_km']} km (Travel Score: {item['travel_score']}đ)")
        print(f"       - Khớp kỹ năng: {item['skill_score']}%")
        print(f"       - Độ uy tín (Karma/Hoàn thành): {item['reputation_score']}đ")
        print(f"       - Khớp thù lao mong muốn: {item['price_score']}đ")

    print("\n⚠️  DANH SÁCH ỨNG VIÊN BỊ LOẠI Ở TẦNG LỌC NHANH (TIER 1):")
    for c in candidates:
        ev = MatchingEngine.evaluate_candidate(c, job)
        if not ev["is_eligible"]:
            print(f"   - ❌ {c.full_name}: {ev['rejection_reason']}")

    # 3. Ký quỹ Escrow
    print("\n" + "-" * 75)
    print("💳 [BƯỚC 3] TIẾN HÀNH KHÓA TIỀN KÝ QUỸ (ESCROW LOCKED)")
    print("-" * 75)
    selected = ranked[0]["candidate"]
    print(f"1. Người thuê chọn ứng viên hàng đầu: {selected.full_name}")

    escrow = EscrowService.lock_escrow(job.id, "poster-001", 3.0, job.hourly_rate_vnd, fee_rate=0.08)
    EscrowService.assign_worker(job.id, selected.id)

    print(f"2. Người thuê nạp và khóa tiền vào ví ký quỹ sàn MCE:")
    print(f"   - Tổng tiền tạm giữ (Gross): {escrow.gross_amount_vnd:,} VNĐ")
    print(f"   - Phí sàn MCE (8%): {escrow.platform_fee_vnd:,} VNĐ")
    print(f"   - Thù lao thực nhận của Worker: {escrow.net_worker_payout_vnd:,} VNĐ")
    print(f"3. Worker xác nhận nhận ca và ký Thỏa thuận nhiệm vụ điện tử.")

    # 4. Check-in Geofence
    print("\n📍 [BƯỚC 4] XÁC THỰC CÓ MẶT BẰNG GPS (GEOFENCE CHECK-IN):")
    # Giả lập khi còn ở xa
    far_pos = Coordinates(lat=21.0330, lng=105.8550)
    ok, msg = EscrowService.check_in(job.id, far_pos, job.location, max_dist_m=150)
    print(f"   - Thử check-in khi còn ở xa: [Thất bại] ❌ {msg}")

    # Check-in chuẩn vị trí
    near_pos = Coordinates(lat=21.0286, lng=105.8545) # cách ~25m
    ok, msg = EscrowService.check_in(job.id, near_pos, job.location, max_dist_m=150)
    print(f"   - Check-in tại địa điểm làm việc: [Thành công] ✅ {msg}")

    # 5. Check-out & Giải ngân
    print("\n🏁 [BƯỚC 5] CHECK-OUT & GIẢI NGÂN THÙ LAO:")
    EscrowService.check_out(job.id, photo_url="https://cdn.mce.vn/proofs/job-hanoi-001.jpg")
    print("   - Worker chụp ảnh 300 kiện hàng hoàn thành -> Trạng thái: PENDING_REVIEW")

    completed = EscrowService.release_escrow(job.id)
    print("   - Người thuê kiểm tra và bấm 'Duyệt hoàn thành'! ✅")
    print(f"   - Trạng thái Escrow cuối cùng: [{completed.state.value}]")
    print(f"   - Đã cộng vào ví Worker: +{completed.net_worker_payout_vnd:,} VNĐ")
    print(f"   - Doanh thu phí sàn ghi nhận: +{completed.platform_fee_vnd:,} VNĐ")

    print("\n" + "=" * 75)
    print("🎉 TOÀN BỘ CHU TRÌNH GIAO DỊCH ĐÃ HOÀN TẤT THÀNH CÔNG, AN TOÀN VÀ MINH BẠCH!")
    print("=" * 75)


if __name__ == "__main__":
    main()
