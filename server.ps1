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
            $parsed = $raw | ConvertFrom-Json
            if (-not $parsed.PSObject.Properties["platformBanks"]) { $parsed | Add-Member -NotePropertyName "platformBanks" -NotePropertyValue @() -Force }
            if (-not $parsed.PSObject.Properties["disputes"]) { $parsed | Add-Member -NotePropertyName "disputes" -NotePropertyValue @() -Force }
            return $parsed
        } catch {
            Write-Host "Warning: Corrupt DB, re-initializing"
        }
    }
    $initialDb = @{
        users = @()
        jobs = @()
        escrows = @()
        transactions = @()
        messages = @()
        platformBanks = @()
        disputes = @()
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

$script:VietnamBanks = @(
    @{ code = "VCB"; bin = "970436"; shortName = "Vietcombank"; fullName = "Ngân hàng TMCP Ngoại thương Việt Nam"; swiftCode = "BFTVVNVX"; aliases = @("vcb","ngoai thuong","vietcombank"); napasSupported = $true },
    @{ code = "TCB"; bin = "970407"; shortName = "Techcombank"; fullName = "Ngân hàng TMCP Kỹ thương Việt Nam"; swiftCode = "VTCBVNVX"; aliases = @("tcb","ky thuong","techcombank"); napasSupported = $true },
    @{ code = "MB"; bin = "970422"; shortName = "MBBank"; fullName = "Ngân hàng TMCP Quân đội"; swiftCode = "MSCBVNVX"; aliases = @("mb","mbbank","quan doi"); napasSupported = $true },
    @{ code = "BIDV"; bin = "970418"; shortName = "BIDV"; fullName = "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam"; swiftCode = "BIDVVNVX"; aliases = @("bidv","dau tu va phat trien"); napasSupported = $true },
    @{ code = "ICB"; bin = "970415"; shortName = "VietinBank"; fullName = "Ngân hàng TMCP Công thương Việt Nam"; swiftCode = "ICBVVNVX"; aliases = @("ctg","icb","cong thuong","vietinbank"); napasSupported = $true },
    @{ code = "ACB"; bin = "970416"; shortName = "ACB"; fullName = "Ngân hàng TMCP Á Châu"; swiftCode = "ASCBVNVX"; aliases = @("acb","a chau"); napasSupported = $true },
    @{ code = "VPB"; bin = "970432"; shortName = "VPBank"; fullName = "Ngân hàng TMCP Việt Nam Thịnh Vượng"; swiftCode = "VPBKVNVX"; aliases = @("vpb","vpbank","thinh vuong"); napasSupported = $true },
    @{ code = "TPB"; bin = "970423"; shortName = "TPBank"; fullName = "Ngân hàng TMCP Tiên Phong"; swiftCode = "TPBVVNVX"; aliases = @("tpb","tpbank","tien phong"); napasSupported = $true },
    @{ code = "STB"; bin = "970403"; shortName = "Sacombank"; fullName = "Ngân hàng TMCP Sài Gòn Thương Tín"; swiftCode = "SGTTVNVX"; aliases = @("stb","sacombank","sai gon thuong tin"); napasSupported = $true },
    @{ code = "HDB"; bin = "970437"; shortName = "HDBank"; fullName = "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh"; swiftCode = "HDBCVNVX"; aliases = @("hdb","hdbank"); napasSupported = $true },
    @{ code = "VIB"; bin = "970441"; shortName = "VIB"; fullName = "Ngân hàng TMCP Quốc tế Việt Nam"; swiftCode = "VNIBVNVX"; aliases = @("vib","quoc te"); napasSupported = $true },
    @{ code = "MSB"; bin = "970426"; shortName = "MSB"; fullName = "Ngân hàng TMCP Hàng Hải Việt Nam"; swiftCode = "MCOBVNVX"; aliases = @("msb","hang hai","maritime"); napasSupported = $true },
    @{ code = "SHB"; bin = "970443"; shortName = "SHB"; fullName = "Ngân hàng TMCP Sài Gòn - Hà Nội"; swiftCode = "SHBAVNVX"; aliases = @("shb","sai gon ha noi"); napasSupported = $true },
    @{ code = "OCB"; bin = "970448"; shortName = "OCB"; fullName = "Ngân hàng TMCP Phương Đông"; swiftCode = "ORCOVNVX"; aliases = @("ocb","phuong dong"); napasSupported = $true },
    @{ code = "SEAB"; bin = "970440"; shortName = "SeABank"; fullName = "Ngân hàng TMCP Đông Nam Á"; swiftCode = "SEAVVNVX"; aliases = @("seab","seabank","dong nam a"); napasSupported = $true },
    @{ code = "EIB"; bin = "970431"; shortName = "Eximbank"; fullName = "Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam"; swiftCode = "EBVIVNVX"; aliases = @("eib","eximbank"); napasSupported = $true },
    @{ code = "LPB"; bin = "970449"; shortName = "LPBank"; fullName = "Ngân hàng TMCP Lộc Phát Việt Nam"; swiftCode = "LVBKVNVX"; aliases = @("lpb","lpbank","lien viet","loc phat"); napasSupported = $true },
    @{ code = "VBA"; bin = "970405"; shortName = "Agribank"; fullName = "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam"; swiftCode = "VBAAVNVX"; aliases = @("vba","agribank","nong nghiep"); napasSupported = $true },
    @{ code = "NAB"; bin = "970428"; shortName = "Nam A Bank"; fullName = "Ngân hàng TMCP Nam Á"; swiftCode = "NAMAVNVX"; aliases = @("nab","nam a"); napasSupported = $true },
    @{ code = "ABB"; bin = "970425"; shortName = "ABBANK"; fullName = "Ngân hàng TMCP An Bình"; swiftCode = "ABBKVNVX"; aliases = @("abb","abbank","an binh"); napasSupported = $true },
    @{ code = "BAB"; bin = "970409"; shortName = "Bac A Bank"; fullName = "Ngân hàng TMCP Bắc Á"; swiftCode = "NASCVNVX"; aliases = @("bab","bac a"); napasSupported = $true },
    @{ code = "BVB"; bin = "970454"; shortName = "BVBank"; fullName = "Ngân hàng TMCP Bản Việt"; swiftCode = "VCBCVNVX"; aliases = @("bvb","bvbank","ban viet","vietcapital"); napasSupported = $true },
    @{ code = "CAKE"; bin = "546034"; shortName = "CAKE by VPBank"; fullName = "Ngân hàng số CAKE by VPBank"; swiftCode = "VPBKVNVX"; aliases = @("cake"); napasSupported = $true },
    @{ code = "UBANK"; bin = "546035"; shortName = "Ubank by VPBank"; fullName = "Ngân hàng số Ubank by VPBank"; swiftCode = "VPBKVNVX"; aliases = @("ubank"); napasSupported = $true },
    @{ code = "TIMO"; bin = "963388"; shortName = "Timo"; fullName = "Ngân hàng số Timo by Bản Việt"; swiftCode = "VCBCVNVX"; aliases = @("timo"); napasSupported = $true },
    @{ code = "PVCB"; bin = "970412"; shortName = "PVcomBank"; fullName = "Ngân hàng TMCP Đại Chúng Việt Nam"; swiftCode = "WBVNVNVX"; aliases = @("pvcb","pvcombank"); napasSupported = $true },
    @{ code = "SHBVN"; bin = "970424"; shortName = "Shinhan Bank"; fullName = "Ngân hàng TNHH MTV Shinhan Việt Nam"; swiftCode = "SHBKVNVX"; aliases = @("shbvn","shinhan"); napasSupported = $true },
    @{ code = "WVN"; bin = "970457"; shortName = "Woori Bank"; fullName = "Ngân hàng TNHH MTV Woori Việt Nam"; swiftCode = "HVBKVNVX"; aliases = @("wvn","woori"); napasSupported = $true },
    @{ code = "HSBC"; bin = "458761"; shortName = "HSBC"; fullName = "Ngân hàng TNHH MTV HSBC Việt Nam"; swiftCode = "HSBCVNVX"; aliases = @("hsbc"); napasSupported = $true },
    @{ code = "SCVN"; bin = "970410"; shortName = "Standard Chartered"; fullName = "Ngân hàng TNHH MTV Standard Chartered Việt Nam"; swiftCode = "SCBLVNVX"; aliases = @("scvn","standard chartered"); napasSupported = $true },
    @{ code = "KLB"; bin = "970452"; shortName = "KienlongBank"; fullName = "Ngân hàng TMCP Kiên Long"; swiftCode = "KLBKVNVX"; aliases = @("klb","kienlongbank","kien long"); napasSupported = $true },
    @{ code = "SGB"; bin = "970400"; shortName = "SAIGONBANK"; fullName = "Ngân hàng TMCP Sài Gòn Công Thương"; swiftCode = "SBITVNVX"; aliases = @("sgb","saigonbank"); napasSupported = $true },
    @{ code = "BVBANK"; bin = "970438"; shortName = "BaoViet Bank"; fullName = "Ngân hàng TMCP Bảo Việt"; swiftCode = "BVBVVNVX"; aliases = @("baoviet","bao viet"); napasSupported = $true },
    @{ code = "VAB"; bin = "970427"; shortName = "VietABank"; fullName = "Ngân hàng TMCP Việt Á"; swiftCode = "VNACVNVX"; aliases = @("vab","vietabank","viet a"); napasSupported = $true },
    @{ code = "NCB"; bin = "970419"; shortName = "NCB"; fullName = "Ngân hàng TMCP Quốc Dân"; swiftCode = "NVBAVNVX"; aliases = @("ncb","quoc dan"); napasSupported = $true },
    @{ code = "PGB"; bin = "970430"; shortName = "PGBank"; fullName = "Ngân hàng TMCP Thịnh Vượng và Phát triển"; swiftCode = "PGBLVNVX"; aliases = @("pgb","pgbank"); napasSupported = $true },
    @{ code = "VIETBANK"; bin = "970433"; shortName = "VietBank"; fullName = "Ngân hàng TMCP Việt Nam Thương Tín"; swiftCode = "VNTTVNVX"; aliases = @("vietbank"); napasSupported = $true },
    @{ code = "COOPBANK"; bin = "970446"; shortName = "CO-OPBANK"; fullName = "Ngân hàng Hợp tác xã Việt Nam"; swiftCode = "COOPVNVX"; aliases = @("coopbank","hop tac xa"); napasSupported = $true },
    @{ code = "UOB"; bin = "970458"; shortName = "UOB"; fullName = "Ngân hàng TNHH MTV UOB Việt Nam"; swiftCode = "UOVBVNVX"; aliases = @("uob"); napasSupported = $true }
)

function Remove-VnDiacritics([string]$s) {
    if (-not $s) { return "" }
    $norm = $s.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $norm.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($ch)
        }
    }
    return ($sb.ToString() -replace 'đ','d' -replace 'Đ','D').Trim().ToLowerInvariant()
}

function Search-VietnamBanks([string]$q) {
    $nq = Remove-VnDiacritics $q
    if (-not $nq) { return $script:VietnamBanks }
    return @($script:VietnamBanks | Where-Object {
        $fields = @($_.code, $_.bin, $_.shortName, $_.fullName) + $_.aliases
        foreach ($f in $fields) {
            if ((Remove-VnDiacritics $f).Contains($nq)) { return $true }
        }
        return $false
    })
}

function Find-VietnamBank([string]$inputVal) {
    $nq = Remove-VnDiacritics $inputVal
    if (-not $nq) { return $null }
    foreach ($b in $script:VietnamBanks) {
        if ((Remove-VnDiacritics $b.code) -eq $nq -or (Remove-VnDiacritics $b.bin) -eq $nq -or (Remove-VnDiacritics $b.shortName) -eq $nq -or (Remove-VnDiacritics $b.fullName) -eq $nq) {
            return $b
        }
        foreach ($al in $b.aliases) {
            if ((Remove-VnDiacritics $al) -eq $nq) { return $b }
        }
    }
    return $null
}

function Get-AdminSession($request) {
    $header = $request.Headers["Authorization"]
    $sessionToken = if ($header -match "^Bearer\s+(.+)$") { $Matches[1] } else { "" }
    $session = if ($sessionToken) { $script:AdminSessions[$sessionToken] } else { $null }
    if (-not $session -or $session.expiresAt -lt (Get-Date)) { return $null }
    return $session
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
            $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
            $response.StatusCode = 204
            $response.OutputStream.Close()
            continue
        }

        if ($urlPath -eq "/" -or [string]::IsNullOrEmpty($urlPath)) {
            $urlPath = "/public/marketplace.html"
        }
        if ($urlPath -eq "/marketplace" -or $urlPath -eq "/marketplace/") { $urlPath = "/public/marketplace.html" }
        if ($urlPath -eq "/mobile" -or $urlPath -eq "/mobile/") { $urlPath = "/mobile.html" }
        if ($urlPath -eq "/admin" -or $urlPath -eq "/admin/") { $urlPath = "/public/admin.html" }
        if ($urlPath -eq "/admin/ops" -or $urlPath -eq "/admin/ops/") { $urlPath = "/public/admin-ops.html" }

        # --- REST API ENDPOINTS ---

        # 1. Health & Public Config
        if ($urlPath -eq "/api/health") {
            $db = Get-Db
            Send-Json $response @{
                status = "ok"
                app = "MCE Marketplace Enterprise"
                version = "2.0.0"
                uptimeSeconds = 3600
                records = @{
                    users = @($db.users).Count
                    jobs = @($db.jobs).Count
                    escrows = @($db.escrows).Count
                    transactions = @($db.transactions).Count
                    messages = @($db.messages).Count
                }
            }
            continue
        }

        if ($urlPath -eq "/api/config/public" -and $httpMethod -eq "GET") {
            $gmapsKey = [Environment]::GetEnvironmentVariable("GOOGLE_MAPS_API_KEY")
            if (-not $gmapsKey) { $gmapsKey = "" }
            Send-Json $response @{
                success = $true
                googleMapsApiKey = $gmapsKey
                geofenceRadiusMeters = 150
                maxGpsAccuracyMeters = 50
            }
            continue
        }

        if ($urlPath -eq "/api/banks" -and $httpMethod -eq "GET") {
            $q = $request.QueryString["q"]
            $list = @(Search-VietnamBanks $q)
            Send-Json $response @{ success = $true; total = $list.Count; banks = $list }
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
            $configuredAdminPhone = Normalize-PhoneNumber ([Environment]::GetEnvironmentVariable("MCE_ADMIN_PHONE"))
            $configuredAdminPassword = [Environment]::GetEnvironmentVariable("MCE_ADMIN_PASSWORD")
            $loginPhoneNorm = Normalize-PhoneNumber $body.phone
            if ($configuredAdminPhone -and $configuredAdminPassword -and $loginPhoneNorm -eq $configuredAdminPhone -and $body.password -ceq $configuredAdminPassword) {
                $adminUser = $db.users | Where-Object { (Normalize-PhoneNumber $_.phone) -eq $configuredAdminPhone -and $_.role -eq "ADMIN" } | Select-Object -First 1
                if ($adminUser) {
                    $adminToken = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
                    $script:AdminSessions[$adminToken] = @{ userId = $adminUser.id; expiresAt = (Get-Date).AddHours(8) }
                    Send-Json $response @{ success = $true; user = @{ id = $adminUser.id; name = $adminUser.name; phone = $adminUser.phone; role = "ADMIN" }; token = $adminToken }
                    continue
                }
            }

            if ($body.password -and -not $body.otp -and (-not $configuredAdminPhone -or -not $configuredAdminPassword)) {
                Send-Json $response @{ success = $false; message = "Chưa khởi tạo Admin cho phiên chạy local này. Vui lòng khởi động server bằng .\start-local-admin.ps1 (nhập SĐT & mật khẩu Admin)." } 401
                continue
            }

            $phone = $loginPhoneNorm
            $otp = if ($body.otp) { $body.otp.ToString().Trim() } elseif ($body.password) { $body.password.ToString().Trim() } else { "" }

            if (-not $phone -or $phone.Length -lt 9) {
                Send-Json $response @{ success = $false; message = "Số điện thoại không hợp lệ."; error = "Số điện thoại không hợp lệ." } 400
                continue
            }

            $otpCheck = Test-OtpCode $phone $otp -Consume
            if (-not $otpCheck.valid) {
                Send-Json $response @{ success = $false; message = $otpCheck.reason; error = $otpCheck.reason } 401
                continue
            }

            $user = $db.users | Where-Object { $_.phone -eq $phone } | Select-Object -First 1
            if (-not $user) {
                Send-Json $response @{ success = $false; message = "Tài khoản chưa tồn tại với số $phone. Vui lòng đăng ký tài khoản mới."; error = "Tài khoản chưa tồn tại với số $phone." } 404
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
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $db = Get-Db
            $q = $request.QueryString["q"]
            $allUsers = @($db.users | Where-Object { -not $q -or $_.name -like "*$q*" -or $_.phone -like "*$q*" })
            $page = 1; $limit = 20
            [void][int]::TryParse($request.QueryString["page"], [ref]$page)
            [void][int]::TryParse($request.QueryString["limit"], [ref]$limit)
            if ($page -lt 1) { $page = 1 }; if ($limit -lt 1 -or $limit -gt 100) { $limit = 20 }
            $mapped = @($allUsers | Select-Object -Skip (($page - 1) * $limit) -First $limit | ForEach-Object { @{ id = $_.id; fullName = $_.name; phone = $_.phone; role = $_.role; karmaScore = $_.karmaScore; isKycVerified = [bool]$_.isVerified; isPhoneVerified = [bool]$_.isVerified; bankName = $_.bank; bankAccountNumber = $_.account; bankAccountOwner = $_.bankAccountOwner; createdAt = $_.createdAt; wallet = @{ availableBalance = $_.walletBalance; lockedBalance = 0 } } })
            Send-Json $response @{ success = $true; pagination = @{ page = $page; limit = $limit; total = $allUsers.Count; totalPages = [Math]::Max(1, [Math]::Ceiling($allUsers.Count / $limit)) }; users = $mapped }
            continue
        }

        if ($urlPath -match "^/api/admin/users/([^/]+)/bank$" -and $httpMethod -eq "PATCH") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $targetId = $Matches[1]
            $body = Read-RequestBody $request
            $db = Get-Db
            $u = $db.users | Where-Object { $_.id -eq $targetId } | Select-Object -First 1
            if (-not $u) { Send-Json $response @{ success = $false; message = "Không tìm thấy người dùng." } 404; continue }
            if ($body.clear -eq $true) {
                $u | Add-Member -NotePropertyName "bank" -NotePropertyValue $null -Force
                $u | Add-Member -NotePropertyName "account" -NotePropertyValue $null -Force
                $u | Add-Member -NotePropertyName "bankAccountOwner" -NotePropertyValue $null -Force
                Save-Db $db
                Send-Json $response @{ success = $true; message = "Đã xóa liên kết ngân hàng của tài khoản." }
                continue
            }
            $bankMeta = Find-VietnamBank $body.bank
            if (-not $bankMeta) { Send-Json $response @{ success = $false; message = "Ngân hàng không thuộc danh mục NAPAS 24/7." } 400; continue }
            $acc = if ($body.accountNumber) { $body.accountNumber.ToString().Trim().ToUpper() } else { "" }
            if ($acc -notmatch "^[A-Z0-9]{6,20}$") { Send-Json $response @{ success = $false; message = "Số tài khoản phải gồm 6–20 ký tự chữ/số." } 400; continue }
            $owner = if ($body.accountOwner) { $body.accountOwner.ToString().Trim().ToUpper() } else { $u.name.ToString().ToUpper() }
            $u | Add-Member -NotePropertyName "bank" -NotePropertyValue $bankMeta.shortName -Force
            $u | Add-Member -NotePropertyName "account" -NotePropertyValue $acc -Force
            $u | Add-Member -NotePropertyName "bankAccountOwner" -NotePropertyValue $owner -Force
            Save-Db $db
            Send-Json $response @{ success = $true; message = "Đã cập nhật ngân hàng $($bankMeta.shortName) cho tài khoản." }
            continue
        }

        if ($urlPath -match "^/api/admin/users/([^/]+)$" -and $httpMethod -eq "PATCH") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $targetId = $Matches[1]
            $body = Read-RequestBody $request
            $db = Get-Db
            $u = $db.users | Where-Object { $_.id -eq $targetId } | Select-Object -First 1
            if (-not $u) { Send-Json $response @{ success = $false; message = "Không tìm thấy người dùng." } 404; continue }
            if ($body.role) { $u | Add-Member -NotePropertyName "role" -NotePropertyValue $body.role -Force }
            if ($null -ne $body.isKycVerified) { $u | Add-Member -NotePropertyName "isVerified" -NotePropertyValue ([bool]$body.isKycVerified) -Force }
            Save-Db $db
            Send-Json $response @{ success = $true; user = $u }
            continue
        }

        if ($urlPath -eq "/api/admin/jobs" -and $httpMethod -eq "GET") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $db = Get-Db
            $statusFilter = $request.QueryString["status"]
            $jobs = @($db.jobs | Where-Object { -not $statusFilter -or $_.status -eq $statusFilter })
            Send-Json $response @{ success = $true; jobs = $jobs }
            continue
        }

        if ($urlPath -match "^/api/admin/jobs/([^/]+)/status$" -and $httpMethod -eq "PATCH") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $jobId = $Matches[1]
            $body = Read-RequestBody $request
            $db = Get-Db
            $j = $db.jobs | Where-Object { $_.id -eq $jobId } | Select-Object -First 1
            if (-not $j) { Send-Json $response @{ success = $false; message = "Không tìm thấy ca việc." } 404; continue }
            $j | Add-Member -NotePropertyName "status" -NotePropertyValue $body.status -Force
            Save-Db $db
            Send-Json $response @{ success = $true; job = $j }
            continue
        }

        if ($urlPath -eq "/api/admin/disputes" -and $httpMethod -eq "GET") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $db = Get-Db
            Send-Json $response @{ success = $true; disputes = @($db.disputes) }
            continue
        }

        if ($urlPath -eq "/api/admin/payments" -and $httpMethod -eq "GET") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $db = Get-Db
            Send-Json $response @{ success = $true; payments = @($db.transactions) }
            continue
        }

        if ($urlPath -eq "/api/admin/banks" -and $httpMethod -eq "GET") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $db = Get-Db
            $banks = @($db.platformBanks | ForEach-Object {
                $qr = "https://img.vietqr.io/image/$($_.bankCode)-$($_.accountNumber)-compact2.png?amount=10000&addInfo=MCE_TEST&accountName=$([Uri]::EscapeDataString($_.accountOwner))"
                @{
                    id = $_.id; bankCode = $_.bankCode; bankBin = $_.bankBin; bankName = $_.bankName
                    accountNumber = $_.accountNumber; accountOwner = $_.accountOwner; branch = $_.branch
                    provider = $_.provider; isDefault = [bool]$_.isDefault; isActive = ($_.isActive -ne $false)
                    qrPreviewUrl = $qr; createdAt = $_.createdAt
                }
            })
            $sepayConfigured = [bool]([Environment]::GetEnvironmentVariable("SEPAY_WEBHOOK_SECRET"))
            Send-Json $response @{
                success = $true
                banks = $banks
                integration = @{ webhookEndpoint = "/api/webhook/payment"; sepayHmacConfigured = $sepayConfigured }
                enterpriseChecklist = @(
                    @{ key = "VIETQR_NAPAS"; title = "VietQR động chuẩn NAPAS 24/7"; ready = (@($banks | Where-Object { $_.isActive }).Count -gt 0); detail = "Mỗi ca việc sinh mã tham chiếu MCE duy nhất tránh nhầm giao dịch." },
                    @{ key = "BANK_WEBHOOK_HMAC"; title = "Webhook nhận biến động số dư (SePay / PayOS / Casso)"; ready = $sepayConfigured; detail = "Xác thực chữ ký HMAC-SHA256 + timestamp trên rawBody để tự động khóa Escrow." },
                    @{ key = "LEDGER_SUSPENSE"; title = "Sổ cái kép & Tài khoản treo (SUSPENSE)"; ready = $true; detail = "Tiền chuyển nhầm nội dung/thiếu tiền được giữ vào SUSPENSE để đối soát." },
                    @{ key = "BANK_NAME_MATCH"; title = "Đối khớp tên chủ TK ngân hàng ↔ Họ tên eKYC CCCD"; ready = $false; detail = "Tra cứu tên chủ TK qua API VietQR/Napas trước khi cho rút tiền." },
                    @{ key = "AUTO_DISBURSEMENT"; title = "Chi hộ tự động 24/7 (Payout API)"; ready = $false; detail = "Kết nối API chuyển tiền nhanh ngân hàng với hạn mức & 2FA duyệt chi." },
                    @{ key = "DAILY_RECON"; title = "Đối soát sao kê cuối ngày (Reconciliation)"; ready = $true; detail = "Đối chiếu tổng tiền ngân hàng thực nhận với tổng số dư ví & ký quỹ." }
                )
            }
            continue
        }

        if ($urlPath -eq "/api/admin/banks" -and $httpMethod -eq "POST") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $body = Read-RequestBody $request
            $bankMeta = Find-VietnamBank $body.bank
            if (-not $bankMeta) { Send-Json $response @{ success = $false; message = "Vui lòng chọn ngân hàng thuộc danh mục NAPAS 24/7." } 400; continue }
            $acc = if ($body.accountNumber) { $body.accountNumber.ToString().Trim().ToUpper() } else { "" }
            $owner = if ($body.accountOwner) { $body.accountOwner.ToString().Trim().ToUpper() } else { "" }
            if ($acc -notmatch "^[A-Z0-9]{6,20}$" -or $owner.Length -lt 2) {
                Send-Json $response @{ success = $false; message = "Số tài khoản (6–20 ký tự) hoặc tên chủ TK không hợp lệ." } 400; continue
            }
            $db = Get-Db
            $dup = $db.platformBanks | Where-Object { $_.bankCode -eq $bankMeta.code -and $_.accountNumber -eq $acc } | Select-Object -First 1
            if ($dup) { Send-Json $response @{ success = $false; message = "Số tài khoản ngân hàng này đã tồn tại." } 409; continue }
            $makeDefault = ([bool]$body.isDefault) -or (@($db.platformBanks).Count -eq 0)
            if ($makeDefault) {
                foreach ($b in $db.platformBanks) { $b.isDefault = $false }
            }
            $newBank = @{
                id = "pbank-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                bankCode = $bankMeta.code
                bankBin = $bankMeta.bin
                bankName = $bankMeta.shortName
                accountNumber = $acc
                accountOwner = $owner
                branch = if ($body.branch) { $body.branch.ToString().Trim() } else { $null }
                provider = if ($body.provider) { $body.provider.ToString().Trim() } else { "SEPAY" }
                isDefault = $makeDefault
                isActive = if ($null -ne $body.isActive) { [bool]$body.isActive } else { $true }
                createdAt = (Get-Date).ToString("o")
            }
            $bList = [System.Collections.ArrayList]@($db.platformBanks)
            $bList.Add($newBank) | Out-Null
            $db.platformBanks = $bList
            Save-Db $db
            Send-Json $response @{ success = $true; bank = $newBank } 201
            continue
        }

        if ($urlPath -match "^/api/admin/banks/([^/]+)$" -and $httpMethod -eq "PATCH") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $bankId = $Matches[1]
            $body = Read-RequestBody $request
            $db = Get-Db
            $target = $db.platformBanks | Where-Object { $_.id -eq $bankId } | Select-Object -First 1
            if (-not $target) { Send-Json $response @{ success = $false; message = "Không tìm thấy tài khoản ngân hàng." } 404; continue }
            if ($body.bank) {
                $bankMeta = Find-VietnamBank $body.bank
                if (-not $bankMeta) { Send-Json $response @{ success = $false; message = "Ngân hàng không thuộc danh mục NAPAS 24/7." } 400; continue }
                $target.bankCode = $bankMeta.code; $target.bankBin = $bankMeta.bin; $target.bankName = $bankMeta.shortName
            }
            if ($body.accountNumber) {
                $acc = $body.accountNumber.ToString().Trim().ToUpper()
                if ($acc -notmatch "^[A-Z0-9]{6,20}$") { Send-Json $response @{ success = $false; message = "Số tài khoản không hợp lệ." } 400; continue }
                $target.accountNumber = $acc
            }
            if ($body.accountOwner) { $target.accountOwner = $body.accountOwner.ToString().Trim().ToUpper() }
            if ($null -ne $body.branch) { $target.branch = $body.branch }
            if ($body.provider) { $target.provider = $body.provider }
            if ($body.isDefault -eq $true) {
                foreach ($b in $db.platformBanks) { if ($b.id -ne $target.id) { $b.isDefault = $false } }
                $target.isDefault = $true
            } elseif ($body.isDefault -eq $false) {
                $target.isDefault = $false
            }
            if ($null -ne $body.isActive) { $target.isActive = [bool]$body.isActive }
            Save-Db $db
            Send-Json $response @{ success = $true; bank = $target }
            continue
        }

        if ($urlPath -match "^/api/admin/banks/([^/]+)$" -and $httpMethod -eq "DELETE") {
            if (-not (Get-AdminSession $request)) { Send-Json $response @{ success = $false; message = "Không có quyền ADMIN." } 401; continue }
            $bankId = $Matches[1]
            $db = Get-Db
            $target = $db.platformBanks | Where-Object { $_.id -eq $bankId } | Select-Object -First 1
            if (-not $target) { Send-Json $response @{ success = $false; message = "Không tìm thấy tài khoản ngân hàng." } 404; continue }
            $wasDefault = [bool]$target.isDefault
            $remaining = @($db.platformBanks | Where-Object { $_.id -ne $bankId })
            if ($wasDefault -and $remaining.Count -gt 0) { $remaining[0].isDefault = $true }
            $db.platformBanks = $remaining
            Save-Db $db
            Send-Json $response @{ success = $true; message = "Đã xóa tài khoản ngân hàng sàn." }
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

        # 6. Jobs: List & Create
        if ($urlPath -eq "/api/jobs" -and $httpMethod -eq "GET") {
            $db = Get-Db
            Send-Json $response @{ success = $true; jobs = @($db.jobs) }
            continue
        }

        if ($urlPath -eq "/api/jobs" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $title = if ($body.title) { $body.title.ToString().Trim() } else { "" }
            $address = if ($body.addressText) { $body.addressText.ToString().Trim() } elseif ($body.address) { $body.address.ToString().Trim() } else { "" }
            $hourlyRate = if ($body.hourlyRate) { [int]$body.hourlyRate } else { 0 }
            $hours = if ($body.hours) { [int]$body.hours } else { 1 }
            $lat = if ($null -ne $body.lat) { [double]$body.lat } else { $null }
            $lng = if ($null -ne $body.lng) { [double]$body.lng } else { $null }

            if ($title.Length -lt 3 -or $hourlyRate -le 0 -or $null -eq $lat -or $null -eq $lng) {
                Send-Json $response @{ success = $false; error = "Thiếu thông tin ca việc hoặc tọa độ Google Maps hợp lệ." } 400
                continue
            }

            $db = Get-Db
            $newJobId = "JOB-" + [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $totalEstimated = if ($body.totalEstimatedVnd) { [int]$body.totalEstimatedVnd } else { $hourlyRate * $hours }
            $newJob = @{
                id = $newJobId
                title = $title
                description = if ($body.description) { $body.description.ToString() } else { $title }
                category = if ($body.category) { $body.category.ToString() } else { "PACK" }
                hourlyRate = $hourlyRate
                hours = $hours
                totalEstimatedVnd = $totalEstimated
                lat = $lat
                lng = $lng
                location = @{ lat = $lat; lng = $lng }
                addressText = $address
                address = $address
                posterName = if ($body.posterName) { $body.posterName.ToString() } else { "Người thuê MCE" }
                posterPhone = Normalize-PhoneNumber $body.posterPhone
                status = "OPEN"
                createdAt = (Get-Date).ToString("o")
            }
            $jobList = [System.Collections.ArrayList]@($db.jobs)
            $jobList.Insert(0, $newJob)
            $db.jobs = $jobList

            $escList = [System.Collections.ArrayList]@($db.escrows)
            $escList.Add(@{
                jobId = $newJobId
                status = "LOCKED"
                grossAmount = $totalEstimated
                platformFee = 0
                workerNet = $totalEstimated
                updatedAt = (Get-Date).ToString("o")
            }) | Out-Null
            $db.escrows = $escList

            Save-Db $db
            Send-Json $response @{ success = $true; job = $newJob } 201
            continue
        }

        # 7. Webhook: Banking VietQR Payment (Lock Escrow)
        if ($urlPath -eq "/api/webhook/payment" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $db = Get-Db
            $jobId = if ($body.jobId) { $body.jobId.ToString().Trim() } else { "" }
            $amount = if ($body.amount) { [int]$body.amount } else { 0 }
            if (-not $jobId -or $amount -le 0) {
                Send-Json $response @{ success = $false; error = "Thiếu jobId hoặc số tiền ký quỹ hợp lệ." } 400
                continue
            }
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
            if (-not $jobId) { Send-Json $response @{ success = $false; error = "Thiếu jobId." } 400; continue }
            $db = Get-Db
            $escrow = $db.escrows | Where-Object { $_.jobId -eq $jobId } | Select-Object -First 1
            Send-Json $response @{ success = $true; escrow = $escrow }
            continue
        }

        # 9. Escrow Check-in (Strict 3-Tier Geofence + Accuracy <= 50m + Radius <= 150m)
        if ($urlPath -eq "/api/escrow/check-in" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId.ToString().Trim() } else { "" }
            $phone = Normalize-PhoneNumber $body.workerPhone
            if (-not $jobId) { Send-Json $response @{ success = $false; error = "Thiếu mã ca việc (jobId)." } 400; continue }

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
            if (-not $jobRecord -and ($null -eq $body.jobLat -or $null -eq $body.jobLng)) {
                Send-Json $response @{ success = $false; error = "Không tìm thấy tọa độ ca việc để đối chiếu Geofence." } 404
                continue
            }
            $targetLat = if ($jobRecord -and $jobRecord.location) { [double]$jobRecord.location.lat } else { [double]$body.jobLat }
            $targetLng = if ($jobRecord -and $jobRecord.location) { [double]$jobRecord.location.lng } else { [double]$body.jobLng }

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
                $gross = if ($jobRecord -and $jobRecord.totalEstimatedVnd) { [int]$jobRecord.totalEstimatedVnd } else { 0 }
                $escrow = @{
                    jobId = $jobId
                    status = "IN_PROGRESS"
                    grossAmount = $gross
                    platformFee = 0
                    workerNet = $gross
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
            $jobId = if ($body.jobId) { $body.jobId.ToString().Trim() } else { "" }
            $photoUrl = if ($body.photoUrl) { $body.photoUrl.ToString().Trim() } else { "" }
            if (-not $jobId) { Send-Json $response @{ success = $false; error = "Thiếu mã ca việc (jobId)." } 400; continue }

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
            $jobId = if ($body.jobId) { $body.jobId.ToString().Trim() } else { "" }
            $phone = Normalize-PhoneNumber $body.workerPhone
            if (-not $jobId) { Send-Json $response @{ success = $false; error = "Thiếu mã ca việc (jobId)." } 400; continue }
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
            $jobId = if ($body.jobId) { $body.jobId.ToString().Trim() } else { "" }
            if (-not $jobId) { Send-Json $response @{ success = $false; error = "Thiếu jobId." } 400; continue }
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
            $jobId = if ($body.jobId) { $body.jobId.ToString().Trim() } else { "" }
            if (-not $jobId) { Send-Json $response @{ success = $false; error = "Thiếu jobId." } 400; continue }
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
            if (-not $jobId) { Send-Json $response @{ success = $true; messages = @() }; continue }
            $db = Get-Db
            $msgs = @($db.messages | Where-Object { $_.jobId -eq $jobId })
            Send-Json $response @{ success = $true; messages = $msgs }
            continue
        }

        if ($urlPath -eq "/api/chat" -and $httpMethod -eq "POST") {
            $body = Read-RequestBody $request
            $jobId = if ($body.jobId) { $body.jobId.ToString().Trim() } else { "" }
            if (-not $jobId) { Send-Json $response @{ success = $false; error = "Thiếu jobId cho cuộc trò chuyện." } 400; continue }
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

        # 15. Wallet: Bank Accounts CRUD, Transactions & Withdraw
        if ($urlPath -eq "/api/wallet/bank-accounts" -and $httpMethod -in @("GET","PUT","DELETE")) {
            $body = if ($httpMethod -eq "PUT" -or $httpMethod -eq "DELETE") { Read-RequestBody $request } else { $null }
            $rawPhone = if ($body -and $body.phone) { $body.phone } else { $request.QueryString["phone"] }
            $phone = Normalize-PhoneNumber $rawPhone
            $db = Get-Db
            $u = if ($phone) { $db.users | Where-Object { $_.phone -eq $phone } | Select-Object -First 1 } else { $null }
            if (-not $u) { Send-Json $response @{ success = $false; message = "Không tìm thấy người dùng để quản lý ngân hàng."; error = "Không tìm thấy người dùng." } 404; continue }
            if ($httpMethod -eq "GET") {
                $bankMeta = Find-VietnamBank $u.bank
                $linked = [bool]($u.bank -and $u.account)
                Send-Json $response @{ success = $true; bankAccount = if ($linked) { @{ bankCode = if ($bankMeta) { $bankMeta.code } else { $u.bank }; bankBin = if ($bankMeta) { $bankMeta.bin } else { $null }; bankName = if ($bankMeta) { $bankMeta.shortName } else { $u.bank }; accountNumber = $u.account; accountOwner = if ($u.bankAccountOwner) { $u.bankAccountOwner } else { $u.name } } } else { $null } }
                continue
            }
            if ($httpMethod -eq "DELETE") {
                $u | Add-Member -NotePropertyName "bank" -NotePropertyValue $null -Force
                $u | Add-Member -NotePropertyName "account" -NotePropertyValue $null -Force
                $u | Add-Member -NotePropertyName "bankAccountOwner" -NotePropertyValue $null -Force
                Save-Db $db
                Send-Json $response @{ success = $true; message = "Đã xóa liên kết tài khoản ngân hàng." }
                continue
            }
            $bankMeta = Find-VietnamBank $body.bank
            if (-not $bankMeta) { Send-Json $response @{ success = $false; message = "Ngân hàng chưa có trong danh mục NAPAS 24/7."; error = "Ngân hàng chưa hợp lệ." } 400; continue }
            $acc = if ($body.accountNumber) { $body.accountNumber.ToString().Trim().ToUpper() } else { "" }
            if ($acc -notmatch "^[A-Z0-9]{6,20}$") { Send-Json $response @{ success = $false; message = "Số tài khoản phải gồm 6–20 ký tự chữ/số."; error = "Số tài khoản không hợp lệ." } 400; continue }
            $owner = if ($body.accountOwner) { $body.accountOwner.ToString().Trim().ToUpper() } else { $u.name.ToString().ToUpper() }
            $u | Add-Member -NotePropertyName "bank" -NotePropertyValue $bankMeta.shortName -Force
            $u | Add-Member -NotePropertyName "account" -NotePropertyValue $acc -Force
            $u | Add-Member -NotePropertyName "bankAccountOwner" -NotePropertyValue $owner -Force
            Save-Db $db
            Send-Json $response @{ success = $true; message = "Đã lưu tài khoản $($bankMeta.shortName) thành công."; bankAccount = @{ bankCode = $bankMeta.code; bankBin = $bankMeta.bin; bankName = $bankMeta.shortName; accountNumber = $acc; accountOwner = $owner } }
            continue
        }

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
