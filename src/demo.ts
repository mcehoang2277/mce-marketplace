import { JobRequirement, WorkerCandidate } from './types';
import { MatchingEngine } from './matching/engine';
import { EscrowService } from './escrow/escrowService';

function runDemo() {
  console.log('========================================================================');
  console.log('🚀 MCE HYPERLOCAL TIME MARKETPLACE — SIMULATION DEMO');
  console.log('========================================================================\n');

  // 1. TẠO CÔNG VIỆC MẪU
  const today = new Date();
  const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0, 0);
  const endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);

  const sampleJob: JobRequirement = {
    id: 'job-hanoi-001',
    title: 'Phụ đóng gói 300 kiện hàng shopee',
    category: 'Kho vận & Đóng hàng',
    slot: { start: startTime, end: endTime },
    location: { lat: 21.028511, lng: 105.854444 }, // Hoàn Kiếm, Hà Nội
    addressText: 'Số 12 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội',
    maxRadiusKm: 6.0,
    hourlyRateVnd: 80000,
    requiredSkills: ['dong_goi', 'can_than'],
    minKarmaScore: 4.0
  };

  console.log('📌 [BƯỚC 1] CÔNG VIỆC ĐƯỢC ĐĂNG:');
  console.log(`   - Tên việc: ${sampleJob.title}`);
  console.log(`   - Khung giờ: 14:00 - 17:00 (3 tiếng)`);
  console.log(`   - Mức thù lao: 80.000 VNĐ / giờ`);
  console.log(`   - Địa điểm: ${sampleJob.addressText}`);
  console.log(`   - Bán kính quét: ${sampleJob.maxRadiusKm} km`);
  console.log(`   - Kỹ năng yêu cầu: [${sampleJob.requiredSkills.join(', ')}]\n`);

  // 2. DANH SÁCH ỨNG VIÊN ĐANG RẢNH TRONG HỆ THỐNG
  const candidates: WorkerCandidate[] = [
    {
      id: 'worker-001',
      fullName: 'Nguyễn Văn An (Sinh viên Bách Khoa)',
      phone: '0981234567',
      location: { lat: 21.0175, lng: 105.8423 }, // Cách ~1.8 km
      freeSlots: [
        {
          start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0, 0),
          end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0, 0)
        }
      ],
      skills: ['dong_goi', 'can_than', 'xe_may', 'excel'],
      karmaScore: 4.9,
      completionRate: 0.98,
      desiredMinHourlyRateVnd: 75000,
      isKycVerified: true
    },
    {
      id: 'worker-002',
      fullName: 'Trần Thị Bình (Tìm việc linh hoạt)',
      phone: '0977654321',
      location: { lat: 21.0501, lng: 105.8123 }, // Cách ~4.9 km
      freeSlots: [
        {
          start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0),
          end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0, 0)
        }
      ],
      skills: ['dong_goi'],
      karmaScore: 4.3,
      completionRate: 0.9,
      desiredMinHourlyRateVnd: 85000,
      isKycVerified: true
    },
    {
      id: 'worker-003',
      fullName: 'Lê Văn Cường (Gần nhưng bận ca khác)',
      phone: '0912345999',
      location: { lat: 21.029, lng: 105.855 }, // Cách ~0.1 km rất gần
      freeSlots: [
        {
          // Chỉ rảnh từ 15:30 -> không đủ ca 14h-17h
          start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30, 0),
          end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0)
        }
      ],
      skills: ['dong_goi', 'can_than'],
      karmaScore: 4.8,
      completionRate: 0.95,
      desiredMinHourlyRateVnd: 70000,
      isKycVerified: true
    },
    {
      id: 'worker-004',
      fullName: 'Phạm Đức Dũng (Ở quá xa)',
      phone: '0933221100',
      location: { lat: 20.9723, lng: 105.8621 }, // Cách ~6.5 km > 6km
      freeSlots: [
        {
          start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0),
          end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0)
        }
      ],
      skills: ['dong_goi', 'can_than'],
      karmaScore: 5.0,
      completionRate: 1.0,
      desiredMinHourlyRateVnd: 70000,
      isKycVerified: true
    }
  ];

  console.log(`🔍 [BƯỚC 2] MATCH ENGINE ĐANG QUÉT ${candidates.length} ỨNG VIÊN ONLINE...`);
  const rankedResults = MatchingEngine.rankCandidates(candidates, sampleJob);

  console.log(`\n🏆 KẾT QUẢ XẾP HẠNG ỨNG VIÊN PHÙ HỢP:`);
  rankedResults.forEach((result, idx) => {
    console.log(`   #${idx + 1}: ${result.candidateName}`);
    console.log(`       - Tổng điểm MATCH SCORE: ${result.totalMatchScore} / 100`);
    console.log(`       - Khoảng cách: ${result.distanceKm} km (Travel Score: ${result.travelScore} đ)`);
    console.log(`       - Khớp kỹ năng: ${result.skillScore}%`);
    console.log(`       - Độ uy tín: ${result.reputationScore} đ`);
    console.log(`       - Mức giá mong muốn: ${result.priceScore} đ`);
  });

  // Xem các ứng viên bị lọc ở Tầng 1
  console.log(`\n⚠️  ỨNG VIÊN BỊ LOẠI Ở TẦNG LỌC NHANH (TIER 1):`);
  candidates.forEach((c) => {
    const evalResult = MatchingEngine.evaluateCandidate(c, sampleJob);
    if (!evalResult.isEligible) {
      console.log(`   - ❌ ${c.fullName}: ${evalResult.rejectionReason}`);
    }
  });

  // 3. MÔ PHỎNG LUỒNG THANH TOÁN ESCROW
  console.log('\n------------------------------------------------------------------------');
  console.log('💳 [BƯỚC 3] LUỒNG THANH TOÁN ESCROW & BẢO VỆ GIAO DỊCH');
  console.log('------------------------------------------------------------------------');

  const topWorker = rankedResults[0];
  console.log(`1. Người thuê chọn: ${topWorker.candidateName}`);

  // Khóa ký quỹ
  const escrow = EscrowService.lockEscrow(sampleJob.id, 'poster-001', 3, sampleJob.hourlyRateVnd, 0.08);
  console.log(`2. Người thuê nạp và KHÓA TIỀN KÝ QUỸ (ESCROW LOCKED):`);
  console.log(`   - Tổng tiền tạm giữ (Gross): ${escrow.grossAmountVnd.toLocaleString('vi-VN')} VNĐ`);
  console.log(`   - Phí sàn dự kiến (8%): ${escrow.platformFeeVnd.toLocaleString('vi-VN')} VNĐ`);
  console.log(`   - Thực nhận của Worker: ${escrow.netWorkerPayoutVnd.toLocaleString('vi-VN')} VNĐ`);

  // Gán Worker & Ký Job Contract
  EscrowService.assignWorker(sampleJob.id, topWorker.candidateId);
  console.log(`3. Worker bấm "Nhận việc" & Ký Hợp đồng nhiệm vụ điện tử.`);

  // 4. MÔ PHỎNG CHECK-IN BẰNG GPS
  console.log('\n📍 [BƯỚC 4] XÁC THỰC CÓ MẶT (CHECK-IN GEOFENCE)');

  // Giả lập check-in sai vị trí (cách 500m)
  const farCoords = { lat: 21.033, lng: 105.855 };
  const failCheckIn = EscrowService.checkIn(sampleJob.id, farCoords, sampleJob.location, 150);
  console.log(`   - Thử check-in khi còn ở xa: [Thất bại] ❌ ${failCheckIn.message}`);

  // Check-in đúng vị trí (sai số 25m)
  const exactCoords = { lat: 21.0286, lng: 105.8545 };
  const okCheckIn = EscrowService.checkIn(sampleJob.id, exactCoords, sampleJob.location, 150);
  console.log(`   - Check-in tại địa điểm làm việc: [Thành công] ✅ ${okCheckIn.message}`);

  // 5. HOÀN THÀNH VÀ GIẢI NGÂN
  console.log('\n🏁 [BƯỚC 5] CHECK-OUT & GIẢI NGÂN TIỀN CÔNG');
  EscrowService.checkOut(sampleJob.id, 'https://cdn.mce.vn/proofs/job-hanoi-001-done.jpg');
  console.log('   - Worker nộp ảnh chụp 300 kiện hàng đã dán nhãn xong -> Trạng thái: PENDING_REVIEW');

  // Poster duyệt giải ngân
  const completedEscrow = EscrowService.releaseEscrow(sampleJob.id);
  console.log(`   - Người thuê bấm "Duyệt hoàn thành"! ✅`);
  console.log(`   - Trạng thái Escrow cuối cùng: [${completedEscrow.state}]`);
  console.log(`   - Tiền được cộng tức thì vào Ví Worker: +${completedEscrow.netWorkerPayoutVnd.toLocaleString('vi-VN')} VNĐ`);
  console.log(`   - Doanh thu phí sàn MCE: +${completedEscrow.platformFeeVnd.toLocaleString('vi-VN')} VNĐ`);

  console.log('\n========================================================================');
  console.log('🎉 TOÀN BỘ CHU TRÌNH GIAO DỊCH ĐÃ HOÀN TẤT AN TOÀN VÀ MINH BẠCH!');
  console.log('========================================================================');
}

runDemo();
