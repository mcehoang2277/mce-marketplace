param (
    [string]$RepoUrl
)

$gitPath = 'C:\Program Files\Git\cmd\git.exe'
if (-not (Test-Path $gitPath)) {
    $gitPath = 'git'
}

$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   MCE MARKETPLACE — KẾT NỐI VÀ ĐẨY CODE LÊN GITHUB      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $RepoUrl) {
    $RepoUrl = Read-Host "Nhập link GitHub Repository của bạn (ví dụ: https://github.com/username/mce-marketplace.git)"
}

if (-not $RepoUrl) {
    Write-Host "[!] Bạn chưa nhập link GitHub. Vui lòng thử lại!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/3] Đang kiểm tra cấu hình remote origin..." -ForegroundColor Yellow
$currentRemote = & $gitPath remote get-url origin 2>$null
if ($currentRemote) {
    Write-Host "Remote origin hiện tại: $currentRemote" -ForegroundColor Gray
    & $gitPath remote set-url origin $RepoUrl
    Write-Host "[OK] Đã cập nhật remote origin thành: $RepoUrl" -ForegroundColor Green
} else {
    & $gitPath remote add origin $RepoUrl
    Write-Host "[OK] Đã gắn remote origin: $RepoUrl" -ForegroundColor Green
}

Write-Host "`n[2/3] Đang kiểm tra nhánh..." -ForegroundColor Yellow
& $gitPath branch -M main
Write-Host "[OK] Nhánh chính: main" -ForegroundColor Green

Write-Host "`n[3/3] Đang đẩy toàn bộ mã nguồn lên GitHub (git push -u origin main)..." -ForegroundColor Yellow
Write-Host "(*) Lưu ý: Nếu Git Credential Manager hiện cửa sổ đăng nhập, hãy chọn 'Sign in with your browser' để xác thực." -ForegroundColor DarkYellow
& $gitPath push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host " [THÀNH CÔNG] Toàn bộ dự án MCE Marketplace đã lên GitHub! " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Bây giờ bạn có thể:"
    Write-Host "1. Vào https://vercel.com/new -> Chọn repo này -> Bấm Deploy (chạy Web 24/7)"
    Write-Host "2. Hoặc bật GitHub Pages trong mục Settings -> Pages của repo."
} else {
    Write-Host "`n[!] Quá trình đẩy code chưa hoàn tất. Vui lòng kiểm tra quyền truy cập repo hoặc đường truyền mạng." -ForegroundColor Yellow
}
