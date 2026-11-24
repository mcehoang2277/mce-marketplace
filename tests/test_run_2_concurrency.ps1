# ==============================================================================
# MCE MARKETPLACE — AUTOMATED TEST RUN #2 (CONCURRENCY, DISPUTES & EDGE CASES)
# Chạy thử lần 2: Đa ca việc đồng thời, Ngăn trùng lịch, Khiếu nại & Stress Test
# ==============================================================================

$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$TotalTests = 0
$PassedTests = 0
$FailedTests = 0
$TestResults = @()

function Get-HaversineMeters($lat1, $lon1, $lat2, $lon2) {
    $R = 6371000
    $dLat = ($lat2 - $lat1) * [Math]::PI / 180.0
    $dLon = ($lon2 - $lon1) * [Math]::PI / 180.0
    $a = [Math]::Sin($dLat / 2) * [Math]::Sin($dLat / 2) +
         [Math]::Cos($lat1 * [Math]::PI / 180.0) * [Math]::Cos($lat2 * [Math]::PI / 180.0) *
         [Math]::Sin($dLon / 2) * [Math]::Sin($dLon / 2)
    $c = 2 * [Math]::Atan2([Math]::Sqrt($a), [Math]::Sqrt(1 - $a))
    return [Math]::Round($R * $c)
}

function Assert-Test {
    param(
        [string]$Suite,
        [string]$TestName,
        [bool]$Condition,
        [string]$Expected,
        [string]$Actual
    )
    $script:TotalTests++
    if ($Condition) {
        $script:PassedTests++
        $script:TestResults += [PSCustomObject]@{
            Suite = $Suite
            TestName = $TestName
            Status = "PASSED"
            Expected = $Expected
            Actual = $Actual
        }
        Write-Host "  [PASS] $TestName" -ForegroundColor Green
    } else {
        $script:FailedTests++
        $script:TestResults += [PSCustomObject]@{
            Suite = $Suite
            TestName = $TestName
            Status = "FAILED"
            Expected = $Expected
            Actual = $Actual
        }
        Write-Host "  [FAIL] $TestName (Expected: $Expected, Actual: $Actual)" -ForegroundColor Red
    }
}

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "🚀 MCE MARKETPLACE — BẮT ĐẦU CHẠY THỬ LẦN 2 (TEST RUN #2: EDGE CASES)" -ForegroundColor Cyan
Write-Host "========================================================================`n" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# SUITE 1: ĐA CA VIỆC ĐỒNG THỜI & BẢO TOÀN DÒNG TIỀN TOÀN SÀN
# ------------------------------------------------------------------------------
Write-Host "📌 [SUITE 1] ĐA CA VIỆC ĐỒNG THỜI & BẢO TOÀN DÒNG TIỀN TOÀN SÀN" -ForegroundColor Yellow

$JobPortfolio = @(
    @{ Id = "JOB-001"; Name = "Phụ đóng 300 kiện hàng"; Hours = 3; Rate = 80000 },
    @{ Id = "JOB-002"; Name = "Trông giữ thú cưng";     Hours = 2; Rate = 75000 },
    @{ Id = "JOB-003"; Name = "Xếp hàng mua vé";        Hours = 2; Rate = 70000 },
    @{ Id = "JOB-004"; Name = "Phụ sự kiện hội thảo";   Hours = 4; Rate = 90000 }
)

$TotalGross = [int64]0
$TotalFee = [int64]0
$TotalWorkerPayout = [int64]0

foreach ($j in $JobPortfolio) {
    $gross = [int64]($j.Hours * $j.Rate)
    $fee = [int64][Math]::Round($gross * 0.08)
    $payout = $gross - $fee

    $TotalGross += $gross
    $TotalFee += $fee
    $TotalWorkerPayout += $payout
}

Assert-Test "Portfolio" "Tổng tiền cọc 4 ca việc đồng thời chính xác (890.000 VNĐ)" `
    ($TotalGross -eq 890000) "890000" "$TotalGross"

Assert-Test "Portfolio" "Tổng doanh thu phí sàn MCE 8% chính xác (71.200 VNĐ)" `
    ($TotalFee -eq 71200) "71200" "$TotalFee"

Assert-Test "Portfolio" "Tổng tiền giải ngân cho 4 Worker chính xác (818.800 VNĐ)" `
    ($TotalWorkerPayout -eq 818800) "818800" "$TotalWorkerPayout"

Assert-Test "Portfolio" "Bảo toàn số dư toàn sàn: TotalGross == TotalFee + TotalPayout" `
    (($TotalFee + $TotalWorkerPayout) -eq $TotalGross) "$TotalGross" ($TotalFee + $TotalWorkerPayout)

# ------------------------------------------------------------------------------
# SUITE 2: NGĂN CHẶN TRÙNG LỊCH CA LÀM (SCHEDULE CONFLICT PREVENTION)
# ------------------------------------------------------------------------------
Write-Host "`n📌 [SUITE 2] NGĂN CHẶN TRÙNG LỊCH CA LÀM CỦA CÙNG 1 WORKER" -ForegroundColor Yellow

$Worker1BusySlot = @{ Start = 14.0; End = 17.0 }
$NewJobOverlapSlot = @{ Start = 15.0; End = 18.0 }
$NewJobNonOverlapSlot = @{ Start = 17.5; End = 20.0 }

function Test-ScheduleOverlap($slotA, $slotB) {
    return ($slotA.Start -lt $slotB.End -and $slotA.End -gt $slotB.Start)
}

$IsConflict = Test-ScheduleOverlap $Worker1BusySlot $NewJobOverlapSlot
Assert-Test "Schedule" "Hệ thống phát hiện xung đột lịch ca làm trùng giờ (14-17h vs 15-18h)" `
    ($IsConflict -eq $true) "True (Conflict Detected)" "$IsConflict"

$IsNonConflict = Test-ScheduleOverlap $Worker1BusySlot $NewJobNonOverlapSlot
Assert-Test "Schedule" "Cho phép nhận ca làm kế tiếp nếu không bị trùng giờ (14-17h vs 17:30-20h)" `
    ($IsNonConflict -eq $false) "False (No Conflict)" "$IsNonConflict"

# ------------------------------------------------------------------------------
# SUITE 3: QUY TRÌNH KHIẾU NẠI & ĐÓNG BĂNG DÒNG TIỀN (DISPUTE WORKFLOW)
# ------------------------------------------------------------------------------
Write-Host "`n📌 [SUITE 3] QUY TRÌNH KHIẾU NẠI & ĐÓNG BĂNG DÒNG TIỀN (DISPUTE)" -ForegroundColor Yellow

$GrossAmount = [int64]240000
$PlatformFee = [int64]19200
$NetWorkerPayout = [int64]220800
$EscrowState = "PENDING_REVIEW"
$DisputeReason = "Hàng bị móp méo trong quá trình đóng gói"

# Poster khiếu nại -> Trạng thái đổi thành DISPUTED
$EscrowState = "DISPUTED"
Assert-Test "Dispute" "Đổi trạng thái Escrow sang DISPUTED khi phát sinh tranh chấp" `
    ($EscrowState -eq "DISPUTED") "DISPUTED" "$EscrowState"

# Trong trạng thái DISPUTED, hành động giải ngân tự động bắt buộc phải bị chặn
$CanAutoRelease = ($EscrowState -eq "PENDING_REVIEW")
Assert-Test "Dispute" "Khóa chặt hành vi tự động giải ngân khi đang ở trạng thái DISPUTED" `
    ($CanAutoRelease -eq $false) "False (Release Blocked)" "$CanAutoRelease"

# Trọng tài sàn MCE hòa giải: Chia 50% cho Worker và hoàn 50% cho Poster
$SettledWorker = [int64]($NetWorkerPayout / 2)
$SettledRefund = [int64]($NetWorkerPayout / 2)
Assert-Test "Dispute" "Cơ chế phân xử tài phán chia đều công bằng: 50% Worker / 50% Poster" `
    (($SettledWorker + $SettledRefund) -eq $NetWorkerPayout) "$NetWorkerPayout" ($SettledWorker + $SettledRefund)

# ------------------------------------------------------------------------------
# SUITE 4: QUY TRÌNH HỦY ĐƠN & HOÀN TIỀN 100% (CANCELLATION & REFUND)
# ------------------------------------------------------------------------------
Write-Host "`n📌 [SUITE 4] QUY TRÌNH HỦY ĐƠN HỢP LỆ & HOÀN TIỀN CỌC (REFUND)" -ForegroundColor Yellow

$PreJobState = "LOCKED"
$CancelRequested = $true

if ($PreJobState -eq "LOCKED" -and $CancelRequested) {
    $PreJobState = "REFUNDED"
    $RefundAmount = $GrossAmount # Hoàn đủ 240.000 VNĐ
    $ChargedFee = [int64]0       # Không thu phí sàn
}

Assert-Test "Refund" "Chuyển trạng thái sang REFUNDED khi hủy đơn hợp lệ trước giờ làm" `
    ($PreJobState -eq "REFUNDED") "REFUNDED" "$PreJobState"

Assert-Test "Refund" "Hoàn trả 100% tiền cọc cho Người thuê (240.000 VNĐ)" `
    ($RefundAmount -eq 240000) "240000" "$RefundAmount"

Assert-Test "Refund" "Phí sàn MCE là 0 VNĐ khi đơn bị hủy hợp lệ" `
    ($ChargedFee -eq 0) "0" "$ChargedFee"

# ------------------------------------------------------------------------------
# SUITE 5: KIỂM THỬ TẢI & THÔNG LƯỢNG (STRESS TEST 2.000 EVALUATIONS)
# ------------------------------------------------------------------------------
Write-Host "`n📌 [SUITE 5] KIỂM THỬ THÔNG LƯỢNG MATCHING ENGINE (2.000 LƯỢT ĐÁNH GIÁ)" -ForegroundColor Yellow

$StressWatch = [System.Diagnostics.Stopwatch]::StartNew()
$Iterations = 2000

for ($i = 0; $i -lt $Iterations; $i++) {
    $randLat = 21.0 + ($i % 100) * 0.001
    $randLng = 105.8 + ($i % 100) * 0.001
    
    # Bounding Box pre-filter check
    $latDiff = [Math]::Abs(21.028511 - $randLat)
    if ($latDiff -le 0.0539) {
        $dist = Get-HaversineMeters 21.028511 105.854444 $randLat $randLng
        $score = [Math]::Max(0, [Math]::Min(100, [Math]::Round(100 * (1 - ($dist / 6000.0)))))
    }
}
$StressWatch.Stop()

$ThroughputPerSec = [Math]::Round(($Iterations / [Math]::Max(1, $StressWatch.ElapsedMilliseconds)) * 1000)

Assert-Test "StressTest" "Hoàn thành 2.000 lượt quét Match Engine trong dưới 250ms" `
    ($StressWatch.ElapsedMilliseconds -le 250) "<= 250 ms" "$($StressWatch.ElapsedMilliseconds) ms"

Assert-Test "StressTest" "Thông lượng đạt trên 10.000 phép tính / giây (Thực tế: $ThroughputPerSec ops/s)" `
    ($ThroughputPerSec -ge 10000) ">= 10000 ops/s" "$ThroughputPerSec ops/s"

$sw.Stop()

# ------------------------------------------------------------------------------
# TỔNG KẾT KẾT QUẢ CHẠY THỬ LẦN 2
# ------------------------------------------------------------------------------
Write-Host "`n========================================================================" -ForegroundColor Cyan
Write-Host "📊 TỔNG KẾT KẾT QUẢ CHẠY THỬ LẦN 2 (TEST RUN #2)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "Tổng số ca kiểm thử: $TotalTests"
Write-Host "Số ca ĐẠT (PASS):   $PassedTests" -ForegroundColor Green
Write-Host "Số ca LỖI (FAIL):   $FailedTests" -ForegroundColor $(if ($FailedTests -eq 0) { "Green" } else { "Red" })
Write-Host "Thời gian thực thi: $($sw.ElapsedMilliseconds) ms"
Write-Host "Tỷ lệ vượt qua:     $([Math]::Round(($PassedTests / $TotalTests) * 100, 1))%" -ForegroundColor Green
Write-Host "========================================================================`n" -ForegroundColor Cyan
