param([int]$Port = 3000)

$ErrorActionPreference = "Stop"
$phone = Read-Host "Nhap so dien thoai Admin (9-15 chu so)"
if ($phone -notmatch '^\+?[0-9]{9,15}$') { throw "So dien thoai khong hop le." }
$name = Read-Host "Nhap ten hien thi Admin"
if ([string]::IsNullOrWhiteSpace($name) -or $name.Trim().Length -lt 2) { throw "Ten Admin khong hop le." }
$securePassword = Read-Host "Tao mat khau Admin (toi thieu 14 ky tu)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ($plainPassword.Length -lt 14) { throw "Mat khau phai co it nhat 14 ky tu." }
    $env:MCE_ADMIN_PHONE = $phone
    $env:MCE_ADMIN_NAME = $name.Trim()
    $env:MCE_ADMIN_PASSWORD = $plainPassword
    Write-Host "Dang khoi dong MCE local tai http://localhost:$Port/admin"
    & (Join-Path $PSScriptRoot "server.ps1") -Port $Port
}
finally {
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    Remove-Item Env:MCE_ADMIN_PHONE -ErrorAction SilentlyContinue
    Remove-Item Env:MCE_ADMIN_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:MCE_ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
