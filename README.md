# MCE Marketplace Core — Nền Tảng Trao Đổi Thời Gian Rảnh Theo Giờ

Hệ thống nguyên mẫu (Core Prototype) và giao diện trực quan cho **MCE Marketplace**, tích hợp đầy đủ dữ liệu phân tích từ buổi hội thảo ý tưởng sáng lập (**Mr. CA**).

---

## 🌟 Điểm nhấn tính năng mới cập nhật từ tài liệu dự án

1. **Phân tích đối thủ chuyên sâu (Market Benchmarking):**
   * So sánh thực tế với app **Tempo: Thuê & Làm Theo Giờ** (Việt Nam, cập nhật tháng 8/2026), **Viec.Co** (100K+ tải), **Tucello** (Lagos, time-sharing), **Instawork** (Mỹ).
   * Lợi thế cốt lõi của MCE: Tích hợp **In-App Escrow + VietQR**, giải ngân bảo đảm và định vị GPS Geofence 150m chống gian lận.
2. **Thuật toán Gợi ý Mức Giá Thị Trường (Dynamic Price Benchmark):**
   * Cung cấp chỉ số định giá thù lao tức thời (70.000 – 90.000 đ/h tại khu vực trung tâm).
   * Cảnh báo thông minh nếu giá quá thấp khó tìm người hoặc thông báo nếu giá hấp dẫn sẽ được nhận ca trong vài phút.
3. **Bộ ca việc mẫu từ nghiên cứu thực tế:**
   * 📦 Phụ đóng 300 kiện hàng shopee (80k/h - 3 tiếng).
   * 🐶 Trông giữ thú cưng chiều thứ 7 (75k/h - 2 tiếng).
   * ⏱️ Xếp hàng mua vé & nhận đồ hộ (70k/h - 2 tiếng).
   * 🎪 Phụ sự kiện & điều phối hội thảo (90k/h - 4 tiếng).
4. **Hồ sơ định danh eKYC & Đăng nhập 1 chạm:**
   * Cổng đăng nhập & đăng ký hợp nhất tại `auth.html`.
   * Mô phỏng quét OCR CCCD gắn chip + Nhận diện khuôn mặt sinh trắc học (Liveness Match 99.4%).
   * Đăng nhập nhanh 1 chạm cho Người làm (Nguyễn Văn An 4.9⭐) và Người thuê (Chủ shop Tràng Thi).
5. **Dự toán tài chính & Ngân sách triển khai:**
   * Dự toán giai đoạn Pilot 1 tỉnh (6 tháng): ~300 – 400 triệu VNĐ.
   * Kịch bản 10.000 giao dịch/tháng đạt doanh thu phí sàn 120.000.000 VNĐ (với phí sàn 8%).
   * Phân 3 tầng rủi ro pháp lý theo Luật BHXH 2024.

---

## 📁 Cấu trúc thư mục dự án (Modular Monolith)

```text
mce-marketplace/
├── src/                                  # Lõi kiến trúc Modular Monolith (TypeScript Production)
│   ├── config/env.ts                     # Quản lý biến môi trường an toàn (Zod / Fail-fast)
│   ├── core/
│   │   ├── database/prisma.ts            # Prisma client singleton
│   │   └── errors/app-error.ts           # Hệ thống phân cấp lỗi & Global Error Handler
│   ├── modules/
│   │   ├── identity/identity.service.ts  # Xác thực tài khoản, eKYC, JWT Session
│   │   ├── matching/matching.service.ts  # Thuật toán Match Engine 2 tầng & Dynamic Benchmark
│   │   ├── escrow/escrow.service.ts      # Máy trạng thái Escrow ACID, BigInt Ledger
│   │   ├── geofence/geofence.service.ts  # Geofence 150m, Chống Fake GPS 3 tầng
│   │   └── payments/
│   │       ├── vietqr.service.ts         # Sinh mã VietQR NAPAS 247 động
│   │       └── payment-webhook.controller.ts # Webhook ngân hàng tự động, Idempotency Cache
│   ├── app.ts                            # Khởi tạo Express App, Routes & Middlewares
│   └── server.ts                         # Entrypoint lắng nghe cổng 8000
├── prisma/
│   └── schema.prisma                     # Thiết kế CSDL PostgreSQL quan hệ hoàn chỉnh
├── index.html                            # Sàn giao dịch Web: Leaflet Map, Match Engine, VietQR, UI Escrow
├── auth.html                             # Cổng đăng nhập & đăng ký xác minh eKYC
├── api_server.py                         # Server Python nhẹ tích hợp SQLite persistence (mce_local.db)
├── docker-compose.yml                    # Docker container: PostgreSQL 16 + Redis 7
├── .env.example                          # Cấu hình biến môi trường mẫu chuẩn Production
├── .gitignore                            # Loại trừ các file rác và bí mật môi trường
├── package.json                          # Dependencies & scripts chuẩn
└── tsconfig.json                         # Cấu hình TypeScript ES2022
```

---

## 🚀 Hướng dẫn khởi chạy hệ thống

### Cách 1: Khởi chạy Client trực tiếp (Không cần cài runtime)
* Nhấp đúp vào file [**`index.html`**](file:///C:/Users/DELL/.gemini/antigravity/scratch/mce-marketplace/index.html) hoặc shortcut [**`MCE Marketplace.url`**](file:///C:/Users/DELL/.gemini/antigravity/scratch/mce-marketplace/MCE%20Marketplace.url).
* Hệ thống sẽ tự động chạy ở chế độ **Graceful Offline Simulation**.

### Cách 2: Khởi chạy Server Node.js / TypeScript (Production Stack)
```bash
cd C:\Users\DELL\.gemini\antigravity\scratch\mce-marketplace
npm install
npm run dev
```
* Mở trình duyệt: **`http://localhost:8000`** (Badge trên header sẽ chuyển sang 🟢 **Server API: Online**).

### Cách 3: Khởi chạy qua Docker Compose (PostgreSQL 16 + Redis 7)
```bash
docker-compose up -d
npm run prisma:migrate
```

### Cách 4: Khởi chạy Server Python nhẹ (SQLite Persistent)
```bash
python api_server.py
```
