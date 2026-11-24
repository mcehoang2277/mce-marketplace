param([int]$Port = 3000)

$root = "C:\Users\DELL\.gemini\antigravity\scratch\mce-marketplace"
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

        # 2. Auth: OTP Send
        if ($urlPath -eq "/api/auth/otp/send" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $phone = if ($body -and $body.phone) { $body.phone } else { "0981234567" }
            $rng = New-Object System.Random
            $otpCode = $rng.Next(100000, 999999).ToString()
            if (-not $script:ActiveOtps) { $script:ActiveOtps = @{} }
            $script:ActiveOtps[$phone] = @{
                code = $otpCode
                expiresAt = (Get-Date).AddSeconds(120)
            }
            Send-Json $response @{
                success = $true
                phone = $phone
                otp = $otpCode
                expiresIn = 120
                message = "Mã OTP xác thực đã được gửi thành công đến $phone!"
            }
            continue
        }

        # 3. Auth: OTP Verify
        if ($urlPath -eq "/api/auth/otp/verify" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $phone = if ($body -and $body.phone) { $body.phone } else { "0981234567" }
            $code = if ($body -and $body.code) { $body.code } else { "" }
            $stored = if ($script:ActiveOtps) { $script:ActiveOtps[$phone] } else { $null }
            if ($code -eq "123456" -or ($stored -and $stored.code -eq $code)) {
                Send-Json $response @{ success = $true; message = "Xác thực OTP thành công!" }
            } else {
                Send-Json $response @{ success = $false; error = "Mã OTP không chính xác hoặc đã hết hạn!" } 400
            }
            continue
        }

        # 4. Auth: Register
        if ($urlPath -eq "/api/auth/register" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $db = Get-Db
            $newUser = @{
                id = "user-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                name = if ($body.name) { $body.name } else { "Người Dùng Mới" }
                phone = $body.phone
                email = $body.email
                idNumber = $body.idNumber
                role = if ($body.role) { $body.role } else { "WORKER" }
                karmaScore = 5.0
                completionRate = 1.0
                walletBalance = 0
                bank = if ($body.bank) { $body.bank } else { "MBBank" }
                account = if ($body.account) { $body.account } else { $body.phone }
                isVerified = $true
            }
            $userList = [System.Collections.ArrayList]@($db.users)
            $userList.Add($newUser) | Out-Null
            $db.users = $userList
            Save-Db $db
            Send-Json $response @{ success = $true; user = $newUser; token = "jwt-" + $newUser.id }
            continue
        }

        # 5. Auth: Login
        if ($urlPath -eq "/api/auth/login" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $db = Get-Db
            $user = $db.users | Where-Object { $_.phone -eq $body.phone } | Select-Object -First 1
            if (-not $user) {
                # Create default user profile for login
                $user = @{
                    id = "user-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    name = "Người Dùng " + $body.phone.Substring([Math]::Max(0, $body.phone.Length - 4))
                    phone = $body.phone
                    email = "user" + $body.phone.Substring([Math]::Max(0, $body.phone.Length - 4)) + "@gmail.com"
                    role = "WORKER"
                    karmaScore = 4.9
                    completionRate = 0.98
                    walletBalance = 0
                    isVerified = $true
                }
            }
            Send-Json $response @{ success = $true; user = $user; token = "jwt-" + $user.id }
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

        # 9. Escrow Check-in
        if ($urlPath -eq "/api/escrow/check-in" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $lat = if ($body.lat) { [double]$body.lat } else { 21.0286 }
            $lng = if ($body.lng) { [double]$body.lng } else { 105.8545 }

            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            if ($escrow) {
                $escrow.status = "IN_PROGRESS"
                $escrow.updatedAt = (Get-Date).ToString("o")
                Save-Db $db
            }
            Send-Json $response @{ success = $true; message = "Check-in thành công tại vị trí thực địa!"; escrowStatus = "IN_PROGRESS" }
            continue
        }

        # 10. Escrow Check-out
        if ($urlPath -eq "/api/escrow/check-out" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            if ($escrow) {
                $escrow.status = "PENDING_REVIEW"
                $escrow.updatedAt = (Get-Date).ToString("o")
                Save-Db $db
            }
            Send-Json $response @{ success = $true; message = "Check-out và nộp bằng chứng thành công!"; escrowStatus = "PENDING_REVIEW" }
            continue
        }

        # 11. Escrow Release
        if ($urlPath -eq "/api/escrow/release" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId } else { "JOB-HANOI-001" }
            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            $payout = 240000
            if ($escrow) {
                $escrow.status = "COMPLETED"
                $payout = $escrow.workerNet
                $escrow.updatedAt = (Get-Date).ToString("o")
            }

            # Update worker wallet
            $worker = $db.users | Where-Object { $_.id -eq "worker-001" } | Select-Object -First 1
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
            $db = Get-Db
            $worker = $db.users | Where-Object { $_.id -eq "worker-001" } | Select-Object -First 1

            $curBalance = if ($worker) { [int]$worker.walletBalance } else { 390000 }
            if ($amount -gt $curBalance) {
                Send-Json $response @{ success = $false; error = "Số dư không đủ để thực hiện lệnh rút!" } 400
                continue
            }

            if ($worker) {
                $worker.walletBalance = $curBalance - $amount
            }

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
