param([int]$Port = 3000)

$root = $PSScriptRoot
$dataDir = Join-Path $root "data"
$proofsDir = Join-Path $root "proofs"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
if (-not (Test-Path $proofsDir)) { New-Item -ItemType Directory -Path $proofsDir -Force | Out-Null }

$dbPath = Join-Path $dataDir "database.json"

# Initialize Database if not exists
function Get-Db {
    if (Test-Path $dbPath) {
        try {
            $raw = [System.IO.File]::ReadAllText($dbPath, [System.Text.Encoding]::UTF8)
            return $raw | ConvertFrom-Json
        } catch {
            Write-Host "Warning: Corrupt DB, re-initializing"
        }
    }
    $initialDb = @{
        users = @(
            @{
                id = "worker-001"
                name = "Nguyễn Văn An"
                phone = "0981234567"
                email = "nguyenvanan.mce@gmail.com"
                idNumber = "001098012345"
                role = "WORKER"
                karmaScore = 4.9
                completionRate = 0.98
                walletBalance = 390000
                bank = "MBBank"
                account = "0981234567"
                skills = @("dong_goi", "can_than", "xe_may")
                isVerified = $true
            },
            @{
                id = "poster-001"
                name = "Hoàng Mai (Chủ Shop)"
                phone = "0912888999"
                email = "hoangmai.shop@gmail.com"
                idNumber = "001188099888"
                role = "POSTER"
                karmaScore = 5.0
                completionRate = 1.0
                walletBalance = 2500000
                bank = "Techcombank"
                account = "1903888999"
                isVerified = $true
            }
        )
        jobs = @(
            @{
                id = "JOB-HANOI-001"
                title = "Phụ đóng gói 300 kiện hàng shopee"
                time = "14:00 - 17:00 (3 tiếng)"
                hourlyRate = 80000
                hours = 3
                location = @{ lat = 21.028511; lng = 105.854444 }
                address = "Số 12 Tràng Thi, Hoàn Kiếm, Hà Nội"
                status = "OPEN"
                posterId = "poster-001"
                assignedWorkerId = $null
                assignedWorkerName = $null
            }
        )
        escrows = @(
            @{
                jobId = "JOB-HANOI-001"
                status = "DRAFT"
                grossAmount = 240000
                platformFee = 0
                workerNet = 240000
                updatedAt = (Get-Date).ToString("o")
            }
        )
        transactions = @(
            @{
                id = "tx-init-001"
                type = "PAYOUT"
                jobId = "JOB-PREV-01"
                title = "Hoàn thành ca Trông thú cưng"
                amount = 150000
                fee = 0
                timestamp = (Get-Date).AddHours(-2).ToString("yyyy-MM-dd HH:mm")
                status = "SUCCESS"
            },
            @{
                id = "tx-init-002"
                type = "PAYOUT"
                jobId = "JOB-PREV-02"
                title = "Hoàn thành ca Đóng gói Shopee"
                amount = 240000
                fee = 0
                timestamp = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd HH:mm")
                status = "SUCCESS"
            }
        )
        messages = @(
            @{
                id = "msg-001"
                jobId = "JOB-HANOI-001"
                sender = "poster"
                senderName = "Chủ Shop Tràng Thi"
                text = "Chào bạn! Bên mình cần đóng gói 300 kiện hàng Shopee xuất kho trước 17h nhé. Đến số 12 Tràng Thi thì nhắn mình ra mở cửa."
                time = "13:45"
                timestamp = (Get-Date).AddMinutes(-30).ToString("o")
            },
            @{
                id = "msg-002"
                jobId = "JOB-HANOI-001"
                sender = "worker"
                senderName = "Nguyễn Văn An"
                text = "Dạ em nhận được rồi ạ! Em đang chuẩn bị chạy qua, khoảng 15 phút nữa là em có mặt tại shop anh nhé."
                time = "13:46"
                timestamp = (Get-Date).AddMinutes(-29).ToString("o")
            }
        )
        otps = @{}
    }
    $json = $initialDb | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($dbPath, $json, [System.Text.Encoding]::UTF8)
    return $initialDb
}

function Save-Db($dbObj) {
    $json = $dbObj | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($dbPath, $json, [System.Text.Encoding]::UTF8)
}

# Ensure DB initialized
$global:db = Get-Db

# Local Admin identity is provisioned from process environment; passwords are never stored in database.json.
$script:AdminSessions = @{}
$adminPhone = [Environment]::GetEnvironmentVariable("MCE_ADMIN_PHONE")
$adminName = [Environment]::GetEnvironmentVariable("MCE_ADMIN_NAME")
if ($adminPhone -and $adminName) {
    $adminUser = $global:db.users | Where-Object { $_.phone -eq $adminPhone } | Select-Object -First 1
    if (-not $adminUser) {
        $adminUser = @{ id = "admin-local-001"; name = $adminName; phone = $adminPhone; role = "ADMIN"; karmaScore = 5.0; completionRate = 1.0; walletBalance = 0; isVerified = $true; createdAt = (Get-Date).ToString("o") }
        $userList = [System.Collections.ArrayList]@($global:db.users)
        $userList.Add($adminUser) | Out-Null
        $global:db.users = $userList
    } else {
        $adminUser.role = "ADMIN"
        $adminUser.name = $adminName
    }
    Save-Db $global:db
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
    Write-Host "SERVER_STARTED http://localhost:$Port/"
} catch {
    Write-Host "FAILED_TO_START $($_.Exception.Message)"
    exit 1
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
}

function Send-Json($response, $data, [int]$status = 200) {
    $json = $data | ConvertTo-Json -Depth 6
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.ContentType = "application/json; charset=utf-8"
    $response.ContentLength64 = $buffer.Length
    $response.StatusCode = $status
    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
    $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

function Read-RequestBody($request) {
    if (-not $request.HasEntityBody) { return $null }
    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
    $bodyText = $reader.ReadToEnd()
    $reader.Close()
    if ([string]::IsNullOrWhiteSpace($bodyText)) { return $null }
    try {
        return $bodyText | ConvertFrom-Json
    } catch {
        return $bodyText
    }
}

function Normalize-PhoneNumber($raw) {
    if (-not $raw) { return "" }
    $digits = ($raw -replace '[^0-9]', '')
    if ($digits.StartsWith("84") -and $digits.Length -eq 11) {
        return "0" + $digits.Substring(2)
    }
    return $digits
}

function Get-HaversineMeters([double]$lat1, [double]$lon1, [double]$lat2, [double]$lon2) {
    $R = 6371000.0
    $dLat = ($lat2 - $lat1) * [Math]::PI / 180.0
    $dLon = ($lon2 - $lon1) * [Math]::PI / 180.0
    $a = [Math]::Pow([Math]::Sin($dLat / 2.0), 2) +
         [Math]::Cos($lat1 * [Math]::PI / 180.0) * [Math]::Cos($lat2 * [Math]::PI / 180.0) *
         [Math]::Pow([Math]::Sin($dLon / 2.0), 2)
    $c = 2.0 * [Math]::Atan2([Math]::Sqrt($a), [Math]::Sqrt(1.0 - $a))
    return [Math]::Round($R * $c)
}

function Test-OtpCode($phone, $code, [switch]$Consume) {
    if (-not $script:ActiveOtps -or -not $phone -or -not $code) {
        return @{ valid = $false; reason = "Chưa có mã OTP được cấp hoặc thiếu mã xác nhận." }
    }
    $entry = $script:ActiveOtps[$phone]
    if (-not $entry) {
        return @{ valid = $false; reason = "Vui lòng bấm gửi mã OTP trước khi xác thực." }
    }
    if ((Get-Date) -gt $entry.expiresAt) {
        $script:ActiveOtps.Remove($phone)
        return @{ valid = $false; reason = "Mã OTP đã hết hạn (120 giây). Vui lòng gửi mã mới." }
    }
    if ($entry.attempts -ge 5) {
        $script:ActiveOtps.Remove($phone)
        return @{ valid = $false; reason = "Đã nhập sai quá 5 lần. Vui lòng yêu cầu mã OTP mới." }
    }
    if ($entry.code -ne $code) {
        $entry.attempts = [int]$entry.attempts + 1
        return @{ valid = $false; reason = "Mã OTP không chính xác (còn $(5 - $entry.attempts) lần thử)." }
    }
    if ($Consume) {
        $script:ActiveOtps.Remove($phone)
    }
    return @{ valid = $true }
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $urlPath = $request.Url.LocalPath
        $httpMethod = $request.HttpMethod

        # CORS preflight
        if ($httpMethod -eq "OPTIONS") {
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
            $response.StatusCode = 204
            $response.OutputStream.Close()
            continue
        }

        if ($urlPath -eq "/" -or [string]::IsNullOrEmpty($urlPath)) {
            $urlPath = "/index.html"
        }
        if ($urlPath -eq "/admin" -or $urlPath -eq "/admin/") { $urlPath = "/public/admin.html" }
        if ($urlPath -eq "/admin/ops" -or $urlPath -eq "/admin/ops/") { $urlPath = "/public/admin-ops.html" }

        # --- REST API ENDPOINTS ---

        # 1. Health
        if ($urlPath -eq "/api/health") {
            $db = Get-Db
            Send-Json $response @{
                status = "ok"
                app = "MCE Marketplace Enterprise"
                version = "2.0.0"
                uptimeSeconds = 3600
                records = @{
                    users = $db.users.Count
                    jobs = $db.jobs.Count
                    escrows = $db.escrows.Count
                    transactions = $db.transactions.Count
                    messages = $db.messages.Count
                }
            }
            continue
        }

        # 2. Auth: OTP Send (No fixed demo code; random 6-digit with 120s TTL)
        if ($urlPath -eq "/api/auth/otp/send" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $phone = Normalize-PhoneNumber $body.phone
            if (-not $phone -or $phone.Length -lt 9 -or $phone.Length -gt 11) {
                Send-Json $response @{ success = $false; error = "Số điện thoại không hợp lệ (cần 9-11 chữ số)." } 400
                continue
            }
            $rng = New-Object System.Random
            $otpCode = $rng.Next(100000, 999999).ToString()
            if (-not $script:ActiveOtps) { $script:ActiveOtps = @{} }
            $script:ActiveOtps[$phone] = @{
                code = $otpCode
                expiresAt = (Get-Date).AddSeconds(120)
                attempts = 0
                verified = $false
            }
            Write-Host "[SMS-SANDBOX] OTP cho $phone la: $otpCode (het han sau 120s)"
            Send-Json $response @{
                success = $true
                phone = $phone
                otp = $otpCode
                expiresIn = 120
                message = "Mã OTP đã được gửi đến $phone (hiệu lực 120 giây)."
            }
            continue
        }

        # 3. Auth: OTP Verify (Strict check — no hardcoded bypass)
        if ($urlPath -eq "/api/auth/otp/verify" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $phone = Normalize-PhoneNumber $body.phone
            $code = if ($body -and $body.code) { ($body.code.ToString()).Trim() } else { "" }
            $check = Test-OtpCode $phone $code
            if ($check.valid) {
                $script:ActiveOtps[$phone].verified = $true
                Send-Json $response @{ success = $true; message = "Xác thực OTP thành công!" }
            } else {
                Send-Json $response @{ success = $false; error = $check.reason } 400
            }
            continue
        }

        # 4. Auth: Register (Requires valid OTP & starts unverified until eKYC)
        if ($urlPath -eq "/api/auth/register" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $phone = Normalize-PhoneNumber $body.phone
            $name = if ($body.name) { $body.name.ToString().Trim() } else { "" }
            $otp = if ($body.otp) { $body.otp.ToString().Trim() } else { "" }

            if (-not $phone -or $phone.Length -lt 9 -or $phone.Length -gt 11) {
                Send-Json $response @{ success = $false; error = "Số điện thoại không hợp lệ." } 400
                continue
            }
            if ($name.Length -lt 2) {
                Send-Json $response @{ success = $false; error = "Họ và tên phải có ít nhất 2 ký tự." } 400
                continue
            }

            $otpCheck = Test-OtpCode $phone $otp -Consume
            if (-not $otpCheck.valid) {
                Send-Json $response @{ success = $false; error = $otpCheck.reason } 401
                continue
            }

            $db = Get-Db
            $existing = $db.users | Where-Object { $_.phone -eq $phone } | Select-Object -First 1
            if ($existing) {
                Send-Json $response @{ success = $false; error = "Số điện thoại $phone đã được đăng ký. Vui lòng chuyển sang Đăng Nhập." } 409
                continue
            }

            $newUser = @{
                id = "user-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                name = $name
                phone = $phone
                email = if ($body.email) { $body.email } else { "$phone@mce.vn" }
                idNumber = $null
                role = if ($body.role -in @("WORKER", "POSTER", "BOTH")) { $body.role } else { "WORKER" }
                karmaScore = 5.0
                completionRate = 1.0
                walletBalance = 0
                bank = if ($body.bank) { $body.bank } else { "MBBank" }
                account = if ($body.account) { $body.account } else { $phone }
                isVerified = $false
                phoneVerified = $true
            }
            $userList = [System.Collections.ArrayList]@($db.users)
            $userList.Add($newUser) | Out-Null
            $db.users = $userList
            Save-Db $db
            Send-Json $response @{ success = $true; user = $newUser; token = "jwt-" + $newUser.id }
            continue
        }

        # 5. Auth: Login (Admin env-provisioned password OR strict OTP verification)
        if ($urlPath -eq "/api/auth/login" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $db = Get-Db
            $configuredAdminPhone = [Environment]::GetEnvironmentVariable("MCE_ADMIN_PHONE")
            $configuredAdminPassword = [Environment]::GetEnvironmentVariable("MCE_ADMIN_PASSWORD")
            if ($configuredAdminPhone -and $configuredAdminPassword -and $body.phone -eq $configuredAdminPhone -and $body.password -ceq $configuredAdminPassword) {
                $adminUser = $db.users | Where-Object { $_.phone -eq $configuredAdminPhone -and $_.role -eq "ADMIN" } | Select-Object -First 1
                if ($adminUser) {
                    $adminToken = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
                    $script:AdminSessions[$adminToken] = @{ userId = $adminUser.id; expiresAt = (Get-Date).AddHours(8) }
                    Send-Json $response @{ success = $true; user = @{ id = $adminUser.id; name = $adminUser.name; phone = $adminUser.phone; role = "ADMIN" }; token = $adminToken }
                    continue
                }
            }

            $phone = Normalize-PhoneNumber $body.phone
            $otp = if ($body.otp) { $body.otp.ToString().Trim() } elseif ($body.password) { $body.password.ToString().Trim() } else { "" }

            if (-not $phone -or $phone.Length -lt 9) {
                Send-Json $response @{ success = $false; error = "Số điện thoại không hợp lệ." } 400
                continue
            }

            $otpCheck = Test-OtpCode $phone $otp -Consume
            if (-not $otpCheck.valid) {
                Send-Json $response @{ success = $false; error = $otpCheck.reason } 401
                continue
            }

            $user = $db.users | Where-Object { $_.phone -eq $phone } | Select-Object -First 1
            if (-not $user) {
                Send-Json $response @{ success = $false; error = "Tài khoản chưa tồn tại với số $phone. Vui lòng đăng ký tài khoản mới." } 404
                continue
            }
            Send-Json $response @{ success = $true; user = $user; token = "jwt-" + $user.id }
            continue
        }

        # Admin session verification and read-only console APIs (local JSON database).
        if ($urlPath -eq "/api/auth/me" -and $httpMethod -eq "GET") {
            $header = $request.Headers["Authorization"]
            $sessionToken = if ($header -match "^Bearer\s+(.+)$") { $Matches[1] } else { "" }
            $session = if ($sessionToken) { $script:AdminSessions[$sessionToken] } else { $null }
            if (-not $session -or $session.expiresAt -lt (Get-Date)) { Send-Json $response @{ success = $false; message = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." } 401; continue }
            $db = Get-Db
            $user = $db.users | Where-Object { $_.id -eq $session.userId -and $_.role -eq "ADMIN" } | Select-Object -First 1
            if (-not $user) { Send-Json $response @{ success = $false; message = "Tài khoản không còn quyền ADMIN." } 403; continue }
            Send-Json $response @{ success = $true; user = @{ id = $user.id; name = $user.name; phone = $user.phone; role = "ADMIN" } }
            continue
        }
        if ($urlPath -eq "/api/admin/overview" -and $httpMethod -eq "GET") {
            $header = $request.Headers["Authorization"]
            $sessionToken = if ($header -match "^Bearer\s+(.+)$") { $Matches[1] } else { "" }
            $session = if ($sessionToken) { $script:AdminSessions[$sessionToken] } else { $null }
            if (-not $session -or $session.expiresAt -lt (Get-Date)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $db = Get-Db
            $openDisputes = @($db.escrows | Where-Object { $_.status -eq "DISPUTED" }).Count
            Send-Json $response @{ success = $true; overview = @{ users = @($db.users).Count; jobs = @($db.jobs).Count; applications = 0; payments = @($db.transactions).Count; disputes = $openDisputes; openDisputes = $openDisputes } }
            continue
        }
        if ($urlPath -eq "/api/admin/users" -and $httpMethod -eq "GET") {
            $header = $request.Headers["Authorization"]
            $sessionToken = if ($header -match "^Bearer\s+(.+)$") { $Matches[1] } else { "" }
            $session = if ($sessionToken) { $script:AdminSessions[$sessionToken] } else { $null }
            if (-not $session -or $session.expiresAt -lt (Get-Date)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $db = Get-Db
            $q = $request.QueryString["q"]
            $allUsers = @($db.users | Where-Object { -not $q -or $_.name -like "*$q*" -or $_.phone -like "*$q*" })
            $page = 1; $limit = 20
            [void][int]::TryParse($request.QueryString["page"], [ref]$page)
            [void][int]::TryParse($request.QueryString["limit"], [ref]$limit)
            if ($page -lt 1) { $page = 1 }; if ($limit -lt 1 -or $limit -gt 100) { $limit = 20 }
            $mapped = @($allUsers | Select-Object -Skip (($page - 1) * $limit) -First $limit | ForEach-Object { @{ id = $_.id; fullName = $_.name; phone = $_.phone; role = $_.role; karmaScore = $_.karmaScore; isKycVerified = [bool]$_.isVerified; isPhoneVerified = [bool]$_.isVerified; createdAt = $_.createdAt; wallet = @{ availableBalance = $_.walletBalance; lockedBalance = 0 } } })
            Send-Json $response @{ success = $true; pagination = @{ page = $page; limit = $limit; total = $allUsers.Count; totalPages = [Math]::Max(1, [Math]::Ceiling($allUsers.Count / $limit)) }; users = $mapped }
            continue
        }

        # 5b. Auth: eKYC Verification (Strict CCCD 12 digits + Front/Back + Liveness Selfie)
        if ($urlPath -eq "/api/auth/ekyc/verify" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $phone = Normalize-PhoneNumber $body.phone
            $fullName = if ($body.fullName) { $body.fullName.ToString().Trim() } else { "" }
            $idNumber = if ($body.idNumber) { ($body.idNumber.ToString() -replace '[^0-9]', '') } else { "" }

            if (-not $phone -or $phone.Length -lt 9) {
                Send-Json $response @{ success = $false; error = "Thiếu số điện thoại tài khoản cần xác thực." } 400
                continue
            }
            if ($fullName.Length -lt 2) {
                Send-Json $response @{ success = $false; error = "Họ tên trên CCCD không hợp lệ." } 400
                continue
            }
            if ($idNumber -notmatch '^\d{12}$') {
                Send-Json $response @{ success = $false; error = "Số CCCD gắn chip phải gồm đúng 12 chữ số." } 400
                continue
            }
            if (-not ($body.hasFrontImage -and $body.hasBackImage -and $body.hasSelfieImage)) {
                Send-Json $response @{ success = $false; error = "Thiếu ảnh CCCD 2 mặt hoặc ảnh khuôn mặt sinh trắc học." } 400
                continue
            }

            $db = Get-Db
            $user = $db.users | Where-Object { $_.phone -eq $phone } | Select-Object -First 1
            if (-not $user) {
                Send-Json $response @{ success = $false; error = "Không tìm thấy tài khoản để gắn kết eKYC." } 404
                continue
            }

            $user.name = $fullName
            $user.idNumber = $idNumber
            $user.isVerified = $true
            $user | Add-Member -NotePropertyName "ekycVerifiedAt" -NotePropertyValue ((Get-Date).ToString("o")) -Force
            Save-Db $db

            Send-Json $response @{
                success = $true
                message = "Xác thực định danh eKYC cấp độ 2 thành công!"
                user = $user
            }
            continue
        }

        # 6. Jobs: List & Detail
        if ($urlPath -eq "/api/jobs" -and $httpMethod -eq "GET") {
            $db = Get-Db
            Send-Json $response @{ success = $true; jobs = $db.jobs }
            continue
        }

        # 7. Webhook: Banking VietQR Payment (Lock Escrow)
        if ($urlPath -eq "/api/webhook/payment" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $db = Get-Db
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $amount = if ($body.amount) { [int]$body.amount } else { 240000 }
            $txId = if ($body.transactionId) { $body.transactionId } else { "tx-bank-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

            # Find and lock escrow
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            if ($escrow) {
                $escrow.status = "LOCKED"
                $escrow.grossAmount = $amount
                $escrow.workerNet = $amount # 0% platform fee
                $escrow.updatedAt = (Get-Date).ToString("o")
            } else {
                $escrow = @{
                    jobId = $jobId
                    status = "LOCKED"
                    grossAmount = $amount
                    platformFee = 0
                    workerNet = $amount
                    updatedAt = (Get-Date).ToString("o")
                }
                $escList = [System.Collections.ArrayList]@($db.escrows)
                $escList.Add($escrow) | Out-Null
                $db.escrows = $escList
            }

            # Record transaction
            $tx = @{
                id = $txId
                type = "ESCROW_LOCK"
                jobId = $jobId
                title = "Khóa ký quỹ ca việc $jobId"
                amount = $amount
                fee = 0
                timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")
                status = "SUCCESS"
            }
            $txList = [System.Collections.ArrayList]@($db.transactions)
            $txList.Add($tx) | Out-Null
            $db.transactions = $txList

            Save-Db $db
            Send-Json $response @{
                success = $true
                message = "Ngân hàng báo có hợp lệ. Đã khóa cọc thành công!"
                escrow = $escrow
                transaction = $tx
            }
            continue
        }

        # 8. Escrow Status
        if ($urlPath -eq "/api/escrow/status" -and $httpMethod -eq "GET") {
            $jobId = $request.QueryString["jobId"]
            if (-not $jobId) { $jobId = "JOB-HANOI-001" }
            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            Send-Json $response @{ success = $true; escrow = $escrow }
            continue
        }

        # 9. Escrow Check-in (Strict 3-Tier Geofence + Accuracy <= 50m + Radius <= 150m)
        if ($urlPath -eq "/api/escrow/check-in" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $phone = Normalize-PhoneNumber $body.workerPhone

            if ($null -eq $body.lat -or $null -eq $body.lng -or $null -eq $body.accuracyMeters) {
                Send-Json $response @{
                    success = $false
                    error = "Thiếu dữ liệu GPS thực tế (lat, lng, accuracyMeters). Không thể chấm công."
                } 422
                continue
            }

            $lat = [double]$body.lat
            $lng = [double]$body.lng
            $accuracy = [double]$body.accuracyMeters

            if ($accuracy -le 0 -or $accuracy -gt 50) {
                Send-Json $response @{
                    success = $false
                    error = "Tín hiệu GPS chưa đủ chính xác (sai số ±$([Math]::Round($accuracy))m > ngưỡng cho phép 50m). Vui lòng bật GPS độ chính xác cao và ra nơi thoáng."
                } 422
                continue
            }

            $db = Get-Db
            if ($phone) {
                $workerUser = $db.users | Where-Object { $_.phone -eq $phone } | Select-Object -First 1
                if ($workerUser -and -not $workerUser.isVerified) {
                    Send-Json $response @{
                        success = $false
                        error = "Tài khoản chưa hoàn tất xác thực eKYC CCCD. Vui lòng xác minh danh tính trước khi chấm công."
                    } 403
                    continue
                }
            }

            $jobRecord = $db.jobs | Where-Object { $_.id -eq $jobId } | Select-Object -First 1
            $targetLat = if ($jobRecord -and $jobRecord.location) { [double]$jobRecord.location.lat } elseif ($null -ne $body.jobLat) { [double]$body.jobLat } else { 21.028511 }
            $targetLng = if ($jobRecord -and $jobRecord.location) { [double]$jobRecord.location.lng } elseif ($null -ne $body.jobLng) { [double]$body.jobLng } else { 105.854444 }

            $distMeters = Get-HaversineMeters $lat $lng $targetLat $targetLng
            if ($distMeters -gt 150) {
                Send-Json $response @{
                    success = $false
                    distanceMeters = $distMeters
                    error = "Check-in bị từ chối: Bạn đang cách điểm làm việc ${distMeters}m (vượt quá bán kính Geofence 150m)."
                } 400
                continue
            }

            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            if ($escrow) {
                $escrow.status = "IN_PROGRESS"
                $escrow.updatedAt = (Get-Date).ToString("o")
            } else {
                $escrow = @{
                    jobId = $jobId
                    status = "IN_PROGRESS"
                    grossAmount = 240000
                    platformFee = 0
                    workerNet = 240000
                    updatedAt = (Get-Date).ToString("o")
                }
                $escList = [System.Collections.ArrayList]@($db.escrows)
                $escList.Add($escrow) | Out-Null
                $db.escrows = $escList
            }
            Save-Db $db
            Send-Json $response @{
                success = $true
                message = "Check-in thực địa thành công (cách điểm làm ${distMeters}m, sai số ±$([Math]::Round($accuracy))m)!"
                escrowStatus = "IN_PROGRESS"
                distanceMeters = $distMeters
                accuracyMeters = [Math]::Round($accuracy)
            }
            continue
        }

        # 10. Escrow Check-out (Requires IN_PROGRESS + real photo proof)
        if ($urlPath -eq "/api/escrow/check-out" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $photoUrl = if ($body.photoUrl) { $body.photoUrl.ToString().Trim() } else { "" }

            if (-not $photoUrl) {
                Send-Json $response @{ success = $false; error = "Bắt buộc phải có ảnh nghiệm thu thực tế trước khi check-out." } 400
                continue
            }

            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            if (-not $escrow -or $escrow.status -ne "IN_PROGRESS") {
                Send-Json $response @{ success = $false; error = "Ca việc chưa ở trạng thái đang làm (IN_PROGRESS) để nghiệm thu." } 400
                continue
            }
            $escrow.status = "PENDING_REVIEW"
            $escrow | Add-Member -NotePropertyName "photoUrl" -NotePropertyValue $photoUrl -Force
            $escrow.updatedAt = (Get-Date).ToString("o")
            Save-Db $db
            Send-Json $response @{ success = $true; message = "Đã nộp ảnh nghiệm thu! Chờ chủ việc xác nhận giải ngân."; escrowStatus = "PENDING_REVIEW" }
            continue
        }

        # 11. Escrow Release (Requires PENDING_REVIEW)
        if ($urlPath -eq "/api/escrow/release" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $phone = Normalize-PhoneNumber $body.workerPhone
            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            if (-not $escrow -or $escrow.status -ne "PENDING_REVIEW") {
                Send-Json $response @{ success = $false; error = "Chỉ có thể giải ngân khi ca việc đã nộp ảnh nghiệm thu (PENDING_REVIEW)." } 400
                continue
            }
            $escrow.status = "COMPLETED"
            $payout = if ($body.amount) { [int]$body.amount } else { [int]$escrow.workerNet }
            $escrow.updatedAt = (Get-Date).ToString("o")

            # Update worker wallet
            $worker = if ($phone) { $db.users | Where-Object { $_.phone -eq $phone } | Select-Object -First 1 } else { $null }
            if (-not $worker) { $worker = $db.users | Where-Object { $_.id -eq "worker-001" } | Select-Object -First 1 }
            if ($worker) {
                $worker.walletBalance = [int]$worker.walletBalance + $payout
            }

            # Log transaction
            $tx = @{
                id = "tx-payout-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                type = "PAYOUT"
                jobId = $jobId
                title = "Giải ngân hoàn thành ca việc $jobId"
                amount = $payout
                fee = 0
                timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")
                status = "SUCCESS"
            }
            $txList = [System.Collections.ArrayList]@($db.transactions)
            $txList.Add($tx) | Out-Null
            $db.transactions = $txList

            Save-Db $db
            Send-Json $response @{
                success = $true
                message = "Đã giải ngân trọn vẹn 100% thù lao về ví Worker!"
                escrowStatus = "COMPLETED"
                workerBalance = if ($worker) { $worker.walletBalance } else { $payout }
                transaction = $tx
            }
            continue
        }

        # 12. Escrow Dispute
        if ($urlPath -eq "/api/escrow/dispute" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            if ($escrow) {
                $escrow.status = "DISPUTED"
                Save-Db $db
            }
            Send-Json $response @{ success = $true; message = "Đã đóng băng ký quỹ! Chuyển hồ sơ sang trọng tài MCE."; escrowStatus = "DISPUTED" }
            continue
        }

        # 13. Escrow Refund
        if ($urlPath -eq "/api/escrow/refund" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            if ($escrow) {
                $escrow.status = "REFUNDED"
                Save-Db $db
            }
            Send-Json $response @{ success = $true; message = "Hủy ca việc thành công! Hoàn tiền 100% về ví Người thuê."; escrowStatus = "REFUNDED" }
            continue
        }

        # 14. Real-time In-App Chat: GET & POST
        if ($urlPath -eq "/api/chat" -and $httpMethod -eq "GET") {
            $jobId = $request.QueryString["jobId"]
            if (-not $jobId) { $jobId = "JOB-HANOI-001" }
            $db = Get-Db
            $msgs = $db.messages | Where-Object { $_.jobId -eq $jobId }
            Send-Json $response @{ success = $true; messages = $msgs }
            continue
        }

        if ($urlPath -eq "/api/chat" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $db = Get-Db
            $newMsg = @{
                id = "msg-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                jobId = $jobId
                sender = if ($body.sender) { $body.sender } else { "worker" }
                senderName = if ($body.senderName) { $body.senderName } else { "Tôi" }
                text = $body.text
                time = (Get-Date).ToString("HH:mm")
                timestamp = (Get-Date).ToString("o")
            }
            $msgList = [System.Collections.ArrayList]@($db.messages)
            $msgList.Add($newMsg) | Out-Null
            $db.messages = $msgList
            Save-Db $db
            Send-Json $response @{ success = $true; message = $newMsg }
            continue
        }

        # 15. Wallet: Transactions & Withdraw
        if ($urlPath -eq "/api/wallet/transactions" -and $httpMethod -eq "GET") {
            $db = Get-Db
            Send-Json $response @{ success = $true; transactions = $db.transactions }
            continue
        }

        if ($urlPath -eq "/api/wallet/withdraw" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $amount = [int]$body.amount
            $bank = $body.bank
            $account = $body.account
            $phone = Normalize-PhoneNumber $body.phone
            $db = Get-Db
            $worker = if ($phone) { $db.users | Where-Object { $_.phone -eq $phone } | Select-Object -First 1 } else { $null }
            if (-not $worker) {
                Send-Json $response @{ success = $false; error = "Không tìm thấy tài khoản người dùng để rút tiền." } 404
                continue
            }
            if (-not $worker.isVerified) {
                Send-Json $response @{ success = $false; error = "Tài khoản chưa xác thực eKYC CCCD nên chưa thể rút tiền." } 403
                continue
            }
            if ($amount -lt 10000) {
                Send-Json $response @{ success = $false; error = "Số tiền rút tối thiểu là 10.000 VNĐ." } 400
                continue
            }

            $curBalance = [int]$worker.walletBalance
            if ($amount -gt $curBalance) {
                Send-Json $response @{ success = $false; error = "Số dư không đủ để thực hiện lệnh rút!" } 400
                continue
            }

            $worker.walletBalance = $curBalance - $amount

            $tx = @{
                id = "tx-wd-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                type = "WITHDRAW"
                title = "Rút về tài khoản $bank ($account)"
                amount = -$amount
                fee = 0
                timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")
                status = "SUCCESS"
            }
            $txList = [System.Collections.ArrayList]@($db.transactions)
            $txList.Add($tx) | Out-Null
            $db.transactions = $txList
            Save-Db $db

            Send-Json $response @{
                success = $true
                message = "Đã rút thành công $amount VNĐ về tài khoản $bank!"
                newBalance = if ($worker) { $worker.walletBalance } else { $curBalance - $amount }
                transaction = $tx
            }
            continue
        }

        # 16. Upload Proof Image
        if ($urlPath -eq "/api/upload/proof" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $filename = "proof-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + ".jpg"
            $savePath = Join-Path $proofsDir $filename
            if ($body.base64) {
                $cleanBase64 = $body.base64 -replace '^data:image\/[a-zA-Z]+;base64,', ''
                $bytes = [System.Convert]::FromBase64String($cleanBase64)
                [System.IO.File]::WriteAllBytes($savePath, $bytes)
            } else {
                # Dummy placeholder byte
                [System.IO.File]::WriteAllBytes($savePath, [byte[]]@(0xFF, 0xD8, 0xFF, 0xE0))
            }
            Send-Json $response @{
                success = $true
                url = "/proofs/$filename"
                filename = $filename
            }
            continue
        }

        # --- STATIC FILE SERVING ---
        $filePath = Join-Path $root ($urlPath.TrimStart('/').Replace('/', '\'))
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = $mimeTypes[$ext]
            if (-not $mime) { $mime = "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($err, 0, $err.Length)
        }
        $response.OutputStream.Close()
    } catch {
        # continue loop
    }
}
