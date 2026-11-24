# HƯỚNG DẪN CHI TIẾT CÁCH ĐƯA DỰ ÁN MCE MARKETPLACE LÊN WEB
> **Dự án:** MCE Marketplace — Hệ sinh thái Việc làm Tức thời 24/7  
> **Tài nguyên Web:** `index.html` (Bản Quản trị / Web Desktop), `mobile.html` (Bản Điện thoại & PWA), `auth.html` (eKYC / Đăng ký), `manifest.json`, `sw.js`.

---

## BẠN NÊN CHỌN CÁCH NÀO?

Tùy theo mục đích hiện tại, bạn có 3 lựa chọn từ nhanh nhất (1 phút) đến chuyên nghiệp nhất:

1. **Cách 1: Test Ngay Lập Tức Từ Máy Tính (Không cần thuê server, có link gửi cho bạn bè/điện thoại test trong 1 phút).**
2. **Cách 2: Đưa lên Nền tảng Đám mây Miễn phí (Vercel hoặc Render.com — chạy 24/7 không cần bật máy tính cá nhân).**
3. **Cách 3: Triển khai Chuyên nghiệp lên Máy chủ VPS Riêng (Chuẩn doanh nghiệp, gắn tên miền riêng .vn, tối ưu thị trường Việt Nam).**

---

## CÁCH 1: TEST NGAY TRÊN ĐIỆN THOẠI & WEB QUA LINK PUBLIC (MIỄN PHÍ - 1 PHÚT)

Nếu bạn muốn có ngay một link web HTTPS để mở trên điện thoại (4G) kiểm tra tính năng GPS bản đồ, camera chụp ảnh và cài đặt PWA:

### Bước 1: Đảm bảo server dự án đang chạy
Server nội bộ đang chạy trên máy tính của bạn tại:
`http://localhost:3000`

### Bước 2: Tạo đường hầm HTTPS công khai (Cloudflare Tunnel / LocalTunnel)
Mở một cửa sổ PowerShell hoặc Command Prompt mới và chạy một trong hai lệnh sau:

**Lựa chọn A (Dùng Cloudflare Tunnel - Khuyên dùng vì ổn định, không cần tài khoản):**
Tải file `cloudflared.exe` từ Cloudflare (hoặc qua winget: `winget install Cloudflare.cloudflared`), sau đó gõ:
```bash
cloudflared tunnel --url http://localhost:3000
```
*Kết quả:* Cloudflare sẽ cung cấp một đường link dạng `https://random-name.trycloudflare.com`. Bạn có thể gửi link này vào Zalo/điện thoại để mở ngay.

**Lựa chọn B (Dùng npx localtunnel - Cực nhanh nếu máy có Node.js):**
```bash
npx localtunnel --port 3000
```
*Kết quả:* Nhận ngay đường link `https://xyz.loca.lt` để test tức thì.

---

## CÁCH 2: TRIỂN KHAI MIỄN PHÍ LÊN CLOUD (VERCEL HOẶC RENDER.COM)

Đây là cách tốt nhất nếu bạn muốn ứng dụng hoạt động 24/7 trên mạng Internet mà không cần bật máy tính cá nhân.

### Phương Án 2.1: Triển khai lên Vercel (Cực nhanh cho bản Web PWA)
Dự án đã có sẵn file cấu hình [vercel.json](file:///C:/Users/DELL/.gemini/antigravity/scratch/mce-marketplace/vercel.json).

1. Truy cập [https://vercel.com](https://vercel.com) và đăng ký tài khoản (đăng nhập bằng GitHub hoặc Email).
2. Tải toàn bộ thư mục `mce-marketplace` lên một kho lưu trữ (Repository) trên [GitHub](https://github.com).
3. Tại trang Vercel Dashboard, bấm **"Add New..."** -> Chọn **"Project"**.
4. Chọn kho lưu trữ GitHub của dự án và bấm **"Deploy"**.
5. Trong vòng 60 giây, Vercel sẽ tự động cấp một link có chứng chỉ bảo mật HTTPS:
   - `https://mce-marketplace.vercel.app`
   - Truy cập bản Mobile: `https://mce-marketplace.vercel.app/mobile`
   - Bấm vào trình duyệt trên điện thoại để cài đặt PWA vào màn hình chính.

### Phương Án 2.2: Triển khai Full-Stack lên Render.com (Cả API và Web)
Dự án đã có sẵn [Dockerfile](file:///C:/Users/DELL/.gemini/antigravity/scratch/mce-marketplace/Dockerfile).

1. Truy cập [https://render.com](https://render.com) và đăng ký tài khoản miễn phí.
2. Bấm **"New +"** -> Chọn **"Web Service"**.
3. Kết nối với GitHub Repo của bạn.
4. Ở mục *Runtime*, chọn **Docker** (Render sẽ tự động đọc file `Dockerfile` có sẵn).
5. Bấm **"Create Web Service"**. Render sẽ tự động dựng container Node.js và cấp link `https://mce-marketplace.onrender.com`.

---

## CÁCH 3: TRIỂN KHAI DOANH NGHIỆP LÊN MÁY CHỦ VPS VIỆT NAM (CHUẨN THƯƠNG MẠI)

Đây là phương án chuẩn nhất khi bạn bắt đầu kinh doanh và chạy ứng dụng cho hàng nghìn người lao động và chủ thuê tại Việt Nam:

### Bước 1: Chuẩn bị VPS & Tên miền
- **Thuê VPS:** Mua 1 gói Cloud VPS tại Việt Nam (Vietnix, BKNS, TinoHost, CMC Telecom, Viettel IDC...).
  - *Cấu hình đề xuất:* 2 Core CPU, 2GB - 4GB RAM, ổ cứng SSD NVMe 30GB, hệ điều hành **Ubuntu 22.04 LTS** (giá khoảng 120.000đ – 250.000đ/tháng).
- **Mua Tên miền:** Mua tên miền mong muốn (ví dụ `mce.vn` hoặc `vieclamtructiep.vn`).

### Bước 2: Trỏ Tên Miền về IP của VPS
Đăng nhập vào trang quản lý tên miền (PA Vietnam, Mắt Bão, Cloudflare...), tạo 2 bản ghi DNS:
- Bản ghi `A`: Tên `@` -> Trỏ đến địa chỉ IP của VPS (ví dụ `103.x.x.x`).
- Bản ghi `A`: Tên `www` -> Trỏ đến địa chỉ IP của VPS.

### Bước 3: Đăng nhập vào VPS qua SSH
Từ máy tính của bạn (dùng Terminal hoặc PowerShell):
```bash
ssh root@<IP_VPS_CỦA_BẠN>
# Nhập mật khẩu VPS được nhà cung cấp gửi qua email
```

### Bước 4: Cài đặt Docker & Git trên VPS
Chạy dòng lệnh sau trên VPS:
```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose git
systemctl enable --now docker
```

### Bước 5: Đưa mã nguồn MCE Marketplace lên VPS
```bash
# Clone hoặc tải mã nguồn vào thư mục /var/www/mce-marketplace
git clone <URL_REPO_CỦA_BẠN> /var/www/mce-marketplace
cd /var/www/mce-marketplace
```

### Bước 6: Khởi chạy hệ thống bằng Docker Compose
Dự án đã cấu hình sẵn [docker-compose.yml](file:///C:/Users/DELL/.gemini/antigravity/scratch/mce-marketplace/docker-compose.yml) và [nginx.conf](file:///C:/Users/DELL/.gemini/antigravity/scratch/mce-marketplace/nginx.conf):
```bash
docker-compose up -d --build
```
Lệnh này sẽ tự động khởi động:
- Cổng đảo ngược Nginx cân bằng tải và bảo mật.
- Node.js Application Server (Port 8000).
- Cơ sở dữ liệu PostgreSQL 16.
- Bộ đệm Redis 7.

### Bước 7: Kích hoạt SSL (HTTPS) Miễn Phí bằng Certbot Let's Encrypt
Để GPS và Camera hoạt động trên trình duyệt điện thoại, HTTPS là bắt buộc:
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d mce.vn -d www.mce.vn
```
Certbot sẽ tự động cài chứng chỉ SSL và tự động gia hạn khi hết hạn.

---

## KIỂM TRA SAU KHI ĐƯA LÊN WEB THÀNH CÔNG

1. **Mở trên máy tính:** Truy cập `https://mce.vn` hoặc `https://your-domain.vercel.app` để xem bản điều hành doanh nghiệp.
2. **Mở trên điện thoại:** Truy cập `https://mce.vn/mobile` hoặc `https://your-domain.vercel.app/mobile`:
   - Kiểm tra pop-up xin cấp quyền định vị GPS và quét radar tìm việc.
   - Thử nghiệm tính năng bấm nhận việc, ký quỹ Escrow VietQR mô phỏng.
   - Bấm nút **"Cài đặt ứng dụng"** (Add to Home Screen) để biến website thành ứng dụng icon ngoài màn hình chính điện thoại.
