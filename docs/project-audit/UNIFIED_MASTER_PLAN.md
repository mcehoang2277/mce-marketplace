# PHƯƠNG ÁN HỢP NHẤT CUỐI CÙNG (FINAL UNIFIED MASTER PLAN)

- **Dự án:** MCE Marketplace (`mce-marketplace`)
- **Ngày lập / Hợp nhất:** `2026-11-26` (Khung 13 tuần: `2026-11-26` → `2027-02-24`)
- **Nguồn hợp nhất:**
  - **Bản A:** [PROJECT_AUDIT_REPORT.md](file:///C:/Users/DELL/.gemini/antigravity/scratch/mce-marketplace/docs/project-audit/PROJECT_AUDIT_REPORT.md) (kiểm toán trực tiếp repo cục bộ tại `390de5a` + thay đổi local trên `mobile.html`, `auth.html`, `server.ps1`, đã chạy `npx tsc --noEmit -p tsconfig.json` và kiểm thử trình duyệt cục bộ).
  - **Bản B:** Kế hoạch kiến trúc, rà soát đường đi của tiền & bảng PMO 6 sheet (31 mục đối chiếu, mô hình công sức, lịch 13 tuần, ngưỡng Go-Live).
- **Nguyên tắc hợp nhất:** Mọi điểm trùng lặp lấy **quyết định chung chặt chẽ nhất**; mọi phần chỉ một bên có được **bổ sung đầy đủ**; đính chính trung thực theo bằng chứng mã nguồn thực tế.

---

## 1. CHỈ SỐ TỔNG QUAN & NGƯỠNG GO-LIVE

| Chỉ số | Giá trị | Ghi chú / Căn cứ |
| :--- | :---: | :--- |
| **Ngày bắt đầu dự án** | `2026-11-26` | Mốc khởi động Giai đoạn 1 |
| **Ngày kết thúc dự kiến (13 tuần)** | `2027-02-24` | Bao gồm 1 tuần Tết (Tuần 11: `2027-02-04` → `2027-02-10`, đóng băng triển khai) |
| **Điểm hiện tại (Kiểm toán)** | **46 / 100** | Đánh giá trực tiếp 8 tiêu chí trên repo thực tế |
| **Ngưỡng điểm Go-Live** | **≥ 80 / 100** | **Bắt buộc kèm:** `0` lỗi `CRITICAL`/`HIGH` + đối soát sổ cái lệch `= 0` |
| **Khoảng cách tới Go-Live** | **+34 điểm** | Tập trung ở Bảo mật (`+6..8đ`), Hoàn thiện chức năng (`+8..10đ`), Kiểm thử (`+6..7đ`) |
| **Tổng số hạng mục đối chiếu** | **31 mục** | `12` cả hai cùng thấy · `8` chỉ kiểm toán thực địa thấy · `11` chỉ rà soát tiền thấy |
| **Tổng công sức kỹ thuật (ước tính)** | **50 – 73 ngày công** | `42–60` ngày công (kiểm toán) + `8–13` ngày công (gói ledger, đối soát, PostGIS, dọn legacy) |
| **Năng lực đội ngũ giả định** | **7.5 ngày công/tuần** | `3` kỹ sư (`2` backend + `1` mobile) × `5` ngày/tuần × hiệu suất thực tế `0.5` |
| **Thời gian kỹ thuật thuần** | **6.7 – 9.7 tuần** | Phần còn lại tới `13 tuần` là buffer cho PSP sandbox, luật sư, eKYC, App Store & nghỉ Tết |
| **Trạng thái nghiệm thu hiện tại** | **`REJECTED`** | Chưa đủ điều kiện mở Production hoặc nhận tiền thật |

> **Lưu ý kiểm chứng thực tế tại repo:** Ở thời điểm lập bản hợp nhất, tại máy cục bộ **chỉ chạy `npx tsc --noEmit -p tsconfig.json`** (không chạy `npm ci` để giữ nguyên trạng môi trường kiểm toán), ghi nhận `node_modules` thiếu dependencies sản xuất, `mobile/node_modules` và `dist/` chưa tồn tại; đồng thời gói file ledger thiết kế ngoài (`ledger.service.ts`, `escrow.ledger.service.ts`, `reconcile.sql`, `20261126000000_ledger_core`, `LEDGER_APPLY_GUIDE.md`) **chưa có trong repo** và cần được nạp vào trước khi áp dụng ở Tuần 1.

---

## 2. CÁC QUYẾT ĐỊNH CHỐT CHUNG (KIẾN TRÚC & ĐIỀU HÀNH)

| Mã | Chủ đề | Phương án chốt cuối cùng | Người quyết định | Trạng thái |
| :-: | :--- | :--- | :---: | :---: |
| **D1** | **Backend & Lưu trữ duy nhất** | `src/` (TypeScript + Express + Prisma + PostgreSQL 16 + PostGIS) là nguồn sự thật duy nhất cho tiền và trạng thái. **Redis** chỉ dùng cho rate limit, cache geohash & **BullMQ cho thông báo**; các tác vụ tiền (tự giải ngân 48h, hết hạn payment intent) chạy bằng **tác vụ quét DB** trên PostgreSQL để tiền không phụ thuộc Redis. | Founder + Tech Lead | **Đề xuất chốt** |
| **D2** | **Client chính & Xử lý Legacy** | **Expo `mobile/`** là ứng dụng chính. Đóng băng `mobile.html` làm bản demo tham khảo (và xử lý `vercel.json` static để không gọi nhầm `/api/*` khi không có backend); chuyển `api_server.py` và `server.ps1` vào `legacy/`. Viết lại `CLAUDE.md` theo định hướng mới (bỏ quy tắc OTP giả `654321`/`123456` và bỏ ưu tiên `mobile.html`). | Founder | **Đề xuất chốt** |
| **D3** | **Mô hình Tiền & Escrow** | Thay thế cả `EscrowService` (Map in-memory) và `PostgresEscrowService` cũ bằng **Sổ cái kép bất biến (`Ledger`)** dùng `BIGINT` VND, `CHECK balance >= 0`, trigger cân bằng, `ON CONFLICT DO NOTHING`, Lock Ordering (`Job` trước → Tài khoản theo key tăng dần), 1 hàm tất toán `settleEscrowTx` duy nhất, tiền không khớp mã vào `SUSPENSE`. | Tech Lead | **Đề xuất chốt** |
| **D4** | **Auth & `passwordHash`** | Chuẩn hóa `passwordHash String NOT NULL` trong `schema.prisma` + `0_init`, kèm hash giả chống dò SĐT ở `/auth/login`, rate limit `/auth/*`, và tích hợp **SMS OTP xác minh sở hữu SĐT** khi đăng ký/đổi mật khẩu (hợp nhất luồng OTP cục bộ với mật khẩu `src/`). | Tech Lead + Product | **Đề xuất chốt** |
| **D5** | **Chính sách phí sàn** | Chốt **0% (khuyến mãi)** hay **8% (thương mại)**. Hệ thống dùng `PLATFORM_FEE_BPS` và chốt mức phí vào từng bản ghi escrow ngay lúc khóa cọc. | **Founder** | **Cần quyết gấp (Tuần 1–2)** |
| **D6** | **Đối tác PSP, OTP, eKYC & Pháp lý** | Chọn nhà cung cấp VietQR/PSP (PayOS/SePay/Casso), SMS OTP, eKYC; làm việc với luật sư về pháp lý giữ tiền hộ / trung gian thanh toán, Luật BHXH 2024 & bảo vệ dữ liệu cá nhân (CCCD, vị trí). | **Founder + Luật sư** | **Cần khởi động Tuần 1–2** |
| **D7** | **Ngưỡng Go-Live** | Điểm kiểm toán **`≥ 80/100`**, **`0` lỗi CRITICAL/HIGH**, **chênh lệch đối soát = `0`** trong 14 ngày Beta, webhook p95 `< 500ms`, `GET /jobs` p95 `< 300ms`, tỷ lệ khiếu nại `< 3%`, có văn bản xác nhận pháp lý. | Founder + QA | **Đề xuất chốt** |

---

## 3. BẢNG ĐỐI CHIẾU & HÀNH ĐỘNG HỢP NHẤT (31 MỤC)

*(Ký hiệu: `P1`–`P7` là Giai đoạn 1–7; nguồn mã tham chiếu: `CRITICAL/HIGH/MEDIUM/LOW-xx` từ Audit 1, `C/H/M/R-x` từ Audit 2.)*

| # | Nguồn phát hiện | Chủ đề | Mô tả hợp nhất & Bằng chứng thực tế | Mã tham chiếu | Hành động hợp nhất | Giai đoạn |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: |
| 1 | Cả hai | Webhook bypass HMAC | `PaymentWebhookController` bỏ qua xác thực khi thiếu `x-webhook-signature` hoặc thiếu secret (`else { isVerified = true }`), route đang nối ở `payment.routes.ts`. | `CRITICAL-01 / C1` | Thay controller: fail-closed (`401`/`503`), xác thực HMAC trên raw body; thêm test HTTP 401/503. | **P1** |
| 2 | Cả hai | Khớp job bằng `contains` | Tìm job bằng `{ id: { contains: jobId } }` và viết hoa UUID gây khớp mơ hồ/sai lệch. | `CRITICAL-01 / H3` | Khớp chính xác bằng **mã tham chiếu ngẫu nhiên 40-bit** (`MCE` + 8 ký tự) gắn payment intent. | **P1** |
| 3 | Cả hai | Không đối chiếu số tiền | Webhook lấy `amount` trực tiếp, không đối chiếu `totalEstimatedVnd` hay đơn thanh toán. | `CRITICAL-01 / C2` | Chỉ khóa escrow khi `amount >= expectedAmount`; tiền lệch/thiếu ghi nhận đúng vào sổ cái & `SUSPENSE`/xử lý tay. | **P1** |
| 4 | Cả hai | Tự cộng tiền ví ảo | `lockEscrowTx` tự cộng vào ví Poster nếu `availableBalance < amount`, không có bút toán ngân hàng đối ứng. | `CRITICAL-01 / C3` | Xóa cơ chế tự cộng ví ảo; mọi tiền vào đi qua journal `BANK_IN` cân bằng 2 vế. | **P1** |
| 5 | Cả hai | So sánh chữ ký không an toàn | Tính HMAC trên `JSON.stringify(req.body)` thay vì byte gốc và so sánh bằng `!==`. | `CRITICAL-01 / H2` | Lưu raw buffer ở middleware trước JSON parse và dùng `crypto.timingSafeEqual`. | **P1** |
| 6 | Cả hai | `Escrow`/`VietQR` khóa `503` & thiếu lifecycle | `escrowRouter` & `/vietqr` trả `503`; thiếu route xem ứng viên, giao việc, check-in/out, khiếu nại, rút tiền. | `CRITICAL-03` | Nối `ApplicationService`, `GeofenceService`, `EscrowLedgerService`, `PayoutService` vào Express routes sau khi test tiền xanh. | **P2** |
| 7 | Cả hai | Thiếu vai trò `ADMIN` | Schema & `auth.middleware.ts` chỉ có `WORKER\|POSTER\|BOTH`, code dùng chuỗi cứng `'SYSTEM_ADMIN'`. | `Mục 7 / H5 / R5` | Thêm `UserRole.ADMIN`, middleware `requireAdmin`, bảng Audit Log và cổng/API quản trị nội bộ. | **P2** |
| 8 | Cả hai | `passwordHash` nullable | `schema.prisma` để `String?` trong khi `bcrypt.compare(password, record.passwordHash)` gây lỗi kiểu TS & rủi ro runtime 500. | `CRITICAL-02 / H6` | Đổi schema sang `String NOT NULL`, kiểm tra null an toàn, thêm hash giả chống dò SĐT lúc login. | **P1** |
| 9 | Cả hai | Thiếu rate limit Auth | Không giới hạn tần suất `/api/auth/login` và `/register` ở tầng ứng dụng. | `Mục 1 / H6` | Gắn `express-rate-limit` (Redis store) + `helmet` bảo mật header. | **P1** |
| 10 | Cả hai | Kiểm thử quá mỏng | Chỉ có 3 unit test `GeoUtils` (`geo.utils.test.cjs`); 0 test tích hợp DB/tiền, tải, bảo mật, E2E; `verify_full_system.ts` chỉ kiểm file/chuỗi. | `Mục 8 / M4` | Viết **test tiền & concurrency ngay từ P1**; hoàn thiện E2E, k6 load test & Security Audit ở **P4**. | **P1, P4** |
| 11 | Cả hai | 4 stack chồng chéo | Tồn tại song song `src/`, `server.ps1`, `api_server.py`, `mobile/` + `mobile.html`/`auth.html`/`index.html`. | `HIGH-03 / M5` | Chốt 1 backend `src/` + 1 client chính Expo `mobile/`; đưa `server.ps1`/`api_server.py` vào `legacy/`. | **P1** |
| 12 | Cả hai | Tài liệu sai lệch với code | `README.md` và `DEPLOY_TO_WEB_GUIDE.md` mô tả `index.html` là "Bản Quản trị" & tính năng chưa bật trên `src/`; `eas.json` còn ID giữ chỗ. | `LOW-01 / M5` | Viết lại `README.md`, `DEPLOY_TO_WEB_GUIDE.md`, bổ sung OpenAPI/Swagger, cập nhật ID store thật. | **P7** |
| 13 | Chỉ Audit 1 | Lỗi biên dịch `GeofenceUtils` | `src/modules/matching/application.service.ts` import `{ GeofenceUtils }` không tồn tại (`TS2305`) và gọi hàm sai tên. | `CRITICAL-02` | Sửa sang `GeoUtils.calculateDistanceMeters`; chạy `npx tsc --noEmit` cả root và `mobile/`. | **P1** |
| 14 | Chỉ Audit 1 | Mật khẩu cứng trong `docker-compose.yml` | Hardcode `mce_secure_password_2026` (Postgres) & `mce_redis_secret_2026` (Redis), thiếu `JWT_SECRET`. | `HIGH-02` | Chuyển toàn bộ sang `${VAR:?required}` đọc từ `.env`; quét secret toàn repo. | **P1** |
| 15 | Chỉ Audit 1 | `nginx.conf` & `vercel.json` sai đích | `nginx.conf` proxy `/` vào `app:8000` (API-only) thiếu TLS; `vercel.json` static không có `/api/*`. | `HIGH-02` | Tách static và `/api/` qua HTTPS trên Nginx; cấu hình API domain riêng hoặc tắt web static gọi `/api/*`. | **P3** |
| 16 | Chỉ Audit 1 | `CacheService` & `Queue` chỉ là RAM | Dùng `Map` & `setTimeout`, mất job khi restart và không chạy được 2+ replica. | `MEDIUM-01` | Dùng **Redis thật** cho cache/rate limit + **BullMQ** cho thông báo; tác vụ tiền quét Postgres. | **P3** |
| 17 | Chỉ Audit 1 | Expo `ActiveShiftScreen` & `WalletScreen` còn mock | `ActiveShiftScreen.tsx` dùng `setTimeout` + tọa độ cứng + ảnh Unsplash; `WalletScreen.tsx` bị khóa tĩnh. | `CRITICAL-03` | Nối API thật (`GeofenceService`, upload ảnh, `Payout`/`Ledger`), hiển thị số dư & lịch sử từ sổ cái. | **P2** |
| 18 | Chỉ Audit 1 | `0_init` hỏng & lockfile lệch | `0_init/migration.sql` thiếu `passwordHash`, mâu thuẫn migration sau; `package-lock.json` cũ; `node_modules` thiếu gói. | `HIGH-01 / CRITICAL-02` | Sửa `0_init`, kiểm tra `prisma migrate deploy` trên DB rỗng rồi mới áp migration `ledger`; đồng bộ `npm ci`. | **P1** |
| 19 | Chỉ Audit 1 | Ảnh CCCD & e-Proof lưu thô | `server.ps1` lưu base64 vào `proofs/` không phân quyền; `src/` chưa có Object Storage. | `MEDIUM-02` | Lưu trên Object Storage riêng tư (S3/R2) với pre-signed URL có hạn + giới hạn MIME/dung lượng. | **P2** |
| 20 | Chỉ Audit 1 | `mobile.html` 4.200+ dòng & Tailwind CDN | Tải nặng trên 3G/4G; `sw.js` cache CDN ngoài. | `MEDIUM-02` | Đóng băng `mobile.html` làm demo tham khảo; dồn tối ưu UI/UX vào Expo `mobile/`. | **P5** |
| 21 | Chỉ Audit 2 | Kích hoạt lại escrow đã giải ngân | `lockEscrowTx` dùng `upsert` đặt lại `status: 'LOCKED'`, không kiểm trạng thái cũ của job/escrow. | `C2` | Thay bằng `escrow.ledger.service.ts`; kiểm tra `job.status` & `WHERE status = 'LOCKED'` phải đúng 1 row. | **P1** |
| 22 | Chỉ Audit 2 | Race condition khi ghi/rút tiền | Đọc số dư rồi ghi giá trị tuyệt đối ở `READ COMMITTED` làm 2 lệnh rút song song cùng thành công. | `C4` | Cập nhật nguyên tử `balance = balance + x` + `CHECK (balance >= 0)`; test 20 lệnh rút đồng thời. | **P1** |
| 23 | Chỉ Audit 2 | Idempotency check-then-act | `findUnique` rồi `upsert` có race; fallback `tx-${Date.now()}` vô hiệu hóa khóa chống trùng. | `H1` | Dùng `INSERT ... ON CONFLICT DO NOTHING RETURNING` trong cùng transaction; từ chối nếu thiếu `transactionId`. | **P1** |
| 24 | Chỉ Audit 2 | Tiền không khớp mã bị bỏ rơi | Trả `200` và đánh dấu `isProcessed = true` khi sai cú pháp/không tìm thấy job -> mất dấu tiền trong ngân hàng. | `H4` | Hạch toán vào tài khoản `SUSPENSE` + `WebhookEvent.outcome`; lập dashboard xử lý tay. | **P1** |
| 25 | Chỉ Audit 2 | `refund`/`release` thiếu kiểm quyền & trạng thái | `refundEscrowTx` không kiểm quyền/trạng thái; `releaseEscrowTx` không bắt buộc `PENDING_REVIEW`. | `H5` | Gom về **1 hàm tất toán `settleEscrowTx`** duy nhất có `allowedJobStatuses` và kiểm quyền chặt chẽ. | **P1** |
| 26 | Chỉ Audit 2 | Deadlock webhook và tất toán | Webhook ghi ví rồi khóa Job, tất toán khóa Job rồi ghi ví -> nguy cơ chờ vòng tròn. | `R2` | Ép quy ước toàn hệ thống: **khóa `Job` trước, rồi khóa các tài khoản sổ cái theo thứ tự key tăng dần**. | **P1** |
| 27 | Chỉ Audit 2 | Lộ dữ liệu cá nhân (PII) | `GET /candidates` lộ SĐT & vị trí ứng viên; `GET /jobs` công khai lộ tọa độ & địa chỉ chính xác người đăng. | `H7` | Làm tròn/che tọa độ công khai, chỉ mở địa chỉ chính xác sau khi `ASSIGNED`; tắt `/api/candidates` demo. | **P1** |
| 28 | Chỉ Audit 2 | Chính sách phí mâu thuẫn | `README` ghi 8%, `CLAUDE.md` và code ghi 0%. | `M2` | Founder chốt phí ở Tuần 1–2; lưu `PLATFORM_FEE_BPS` trực tiếp vào từng escrow lúc khóa. | **P1** |
| 29 | Chỉ Audit 2 | Pháp lý giữ tiền hộ & BHXH 2024 | Nhận/giữ tiền người dùng có thể thuộc diện trung gian thanh toán; cần tư vấn bảo vệ dữ liệu & BHXH. | `M7` | Hẹn luật sư từ Tuần 1–2; bắt buộc có xác nhận văn bản trước khi nhận tiền thật (kể cả Beta). | **P1** |
| 30 | Chỉ Audit 2 | `CLAUDE.md` chỉ đạo OTP giả | Quy tắc #3 trong `CLAUDE.md` giữ OTP giả `654321`/`123456` & ưu tiên `mobile.html`. | `H6` | Viết lại `CLAUDE.md` ngay ở Tuần 1 theo kiến trúc đồng nhất (`src/` + Expo + OTP thật). | **P1** |
| 31 | Chỉ Audit 2 | Rủi ro kỳ nghỉ Tết Đinh Mùi | Tết khoảng `06/02/2027` (Tuần 11), ngân hàng/PSP chậm, nhân sự nghỉ. | `Lịch 90 ngày` | Chạy Closed Beta ở Tuần 10 trước Tết; **đóng băng triển khai** ở Tuần 11, chỉ quan sát & tải test. | **P5–P6** |

---

## 4. ƯỚC TÍNH CÔNG SUẤT & THANG ĐIỂM MỤC TIÊU

### 4.1 Bảng ước tính công sức (14 hạng mục — `50–73` ngày công)

| STT | Hạng mục công việc | Nguồn | Ngày công thấp | Ngày công cao | Ưu tiên |
| :-: | :--- | :---: | :---: | :---: | :---: |
| 1 | Xác thực & định danh (`OTP`, `eKYC`, `RBAC`) | Audit 1 | 5 | 7 | **CRITICAL** |
| 2 | Quản lý ca việc & khớp lệnh | Audit 1 | 4 | 5 | **HIGH** |
| 3 | Định vị chấm công & Geofence server-side | Audit 1 | 4 | 6 | **CRITICAL** |
| 4 | Ký quỹ, VietQR & Ví tiền | Audit 1 | 7 | 10 | **CRITICAL** |
| 5 | Cơ sở dữ liệu & Migration baseline | Audit 1 | 2 | 3 | **HIGH** |
| 6 | Giao diện Expo (`mobile/`) & xử lý Web/PWA | Audit 1 | 5 | 8 | **HIGH** |
| 7 | Bảo mật, phân quyền `ADMIN`, audit log | Audit 1 | 5 | 7 | **CRITICAL** |
| 8 | Kiểm thử tự động (7 cấp độ) & CI/CD | Audit 1 | 5 | 7 | **HIGH** |
| 9 | Hạ tầng Docker/Nginx/Redis/Queue & vận hành | Audit 1 | 3 | 5 | **MEDIUM** |
| 10 | Tài liệu kỹ thuật, OpenAPI & bàn giao | Audit 1 | 2 | 2 | **LOW** |
| 11 | Nạp, điều chỉnh & test gói `Ledger` + sửa lỗi biên dịch gói | Audit 2 | 3 | 5 | **CRITICAL** |
| 12 | Đối soát hằng ngày (`reconcile.sql` cron, cảnh báo, `SUSPENSE`, runbook) | Audit 2 | 2 | 3 | **HIGH** |
| 13 | PostGIS (`geography` + `GiST` + `ST_DWithin`) & phân trang con trỏ | Audit 2 | 2 | 3 | **MEDIUM** |
| 14 | Dọn `legacy/`, xử lý `vercel.json` & viết lại `CLAUDE.md` | Audit 2 | 1 | 2 | **MEDIUM** |
| | **TỔNG CÔNG SỨC KỸ THUẬT** | | **50** | **73** | **6.7 – 9.7 tuần** *(với 7.5 ngày công/tuần)* |

### 4.2 Thang điểm 100 & Khoảng cách tới ngưỡng Go-Live (`≥ 80`)

| STT | Tiêu chí | Tối đa | Hiện tại (`26/11`) | Tỷ lệ | Giai đoạn cải thiện chính |
| :-: | :--- | :---: | :---: | :---: | :---: |
| 1 | Mức độ hoàn thiện chức năng | 20 | **9** | 45% | **P2** |
| 2 | Chất lượng mã nguồn & kiến trúc | 15 | **7** | 47% | **P1** |
| 3 | Hiệu năng & tốc độ | 15 | **8** | 53% | **P3** |
| 4 | Giao diện & trải nghiệm người dùng | 10 | **6** | 60% | **P5** |
| 5 | Bảo mật & an toàn dữ liệu | 15 | **6** | 40% | **P1** |
| 6 | Kiểm thử & độ ổn định | 10 | **2** | 20% | **P1, P4** |
| 7 | Khả năng mở rộng | 10 | **5** | 50% | **P3** |
| 8 | Tài liệu & khả năng bàn giao | 5 | **3** | 60% | **P7** |
| | **TỔNG ĐIỂM** | **100** | **46** | **46%** | **Cần +34 điểm để đạt ngưỡng ≥ 80** |

---

## 5. LỊCH HỢP NHẤT 13 TUẦN (7 GIAI ĐOẠN · 3 CỔNG NGHIỆM THU)

| Tuần | Thời gian | Giai đoạn | Nội dung thực hiện hợp nhất | Điều kiện đầu vào & Cổng chuyển giai đoạn |
| :-: | :---: | :---: | :--- | :--- |
| **1–2** | `2026-11-26` → `2026-12-09` | **Giai đoạn 1** *(Bảo mật, Build, Ledger & Pháp lý)* | Đồng bộ `npm ci` + `package-lock.json`; sửa `0_init`, `passwordHash NOT NULL` + fake hash, `GeofenceUtils` (`application.service.ts`) & `identity.service.ts`; bỏ secret cứng Docker; nạp gói **Sổ cái kép `Ledger`** + vá **HMAC raw-body** webhook + `SUSPENSE`; thêm `helmet`, rate limit, che dữ liệu `/jobs` & `/candidates`; viết lại `CLAUDE.md`; **Founder chốt phí, PSP, đặt lịch luật sư & xin sandbox**. | **Đầu vào:** Phê duyệt D1–D4.<br>**Cổng 1:** `npm ci`, `tsc --noEmit` (root & mobile), `prisma migrate deploy` trên DB rỗng & test concurrency/HMAC tiền **xanh 100%**. Có lịch luật sư & văn bản quyết định phí/PSP. |
| **3–6** | `2026-12-10` → `2027-01-06` | **Giai đoạn 2** *(Sandbox PSP, Lifecycle, Geofence, Admin & Expo thật)* | Nối PSP sandbox + đối soát hằng ngày (`reconcile.sql` cron + dashboard `SUSPENSE`); mở route ứng tuyển/giao việc, Geofence 3 tầng server-side, upload ảnh e-Proof/CCCD lên Object Storage (signed URL); thêm `UserRole.ADMIN` + Audit Log; tích hợp SMS OTP thật + khiếu nại (`settleEscrowTx`); worker rút tiền thật; **thay toàn bộ mock trên Expo `ActiveShiftScreen` & `WalletScreen`**. | **Đầu vào:** Qua Cổng 1 + có sandbox PSP.<br>**Cổng 2 (Cổng B):** Vòng đời đầy đủ từ `Đăng ký → Nạp tiền → Giao việc → Check-in/out → Giải ngân → Rút tiền` chạy thông suốt trên Staging với tiền sandbox; **0 lệch sổ cái trong 5 ngày liên tiếp**; có ý kiến luật sư bằng văn bản. |
| **5–8** | `2026-12-24` → `2027-01-20` | **Giai đoạn 3** *(Hiệu năng, Redis/BullMQ, PostGIS & Nginx/Vercel)* | Nối **Redis thật** (rate limit, cache geohash `GET /jobs`), **BullMQ** (thông báo đẩy qua outbox), **tác vụ quét DB** (tự giải ngân 48h, hết hạn payment intent); nâng cấp **PostGIS** (`geography` + `GiST` + `ST_DWithin`) & phân trang con trỏ; sửa `nginx.conf` (tách static & `/api/` + HTTPS); xử lý `vercel.json` & đưa script cũ vào `legacy/`. | **Đầu vào:** Các API lõi ở Giai đoạn 2 đã ổn định.<br>**Cổng 3:** Chạy `≥ 2` replica API stateless qua Nginx + Postgres + Redis không mất trạng thái; không còn truy vấn N+1. |
| **7–9** | `2027-01-07` → `2027-01-27` | **Giai đoạn 4** *(Kiểm thử 7 cấp độ)* | Hoàn thiện Unit test (coverage `≥ 80%` module lõi), Integration/Concurrency test trên Postgres/Redis thật, API Contract/Regression test, E2E tự động, **Load test k6** (`≥ 20 req/s`, p95 webhook `< 500ms`, `GET /jobs` `< 300ms`) và **Security check**. | **Đầu vào:** Hoàn thành Giai đoạn 2 & 3.<br>**Cổng 4:** 100% bộ test tự động xanh trên CI, đạt ngân sách hiệu năng, `0` lỗi CRITICAL/HIGH. |
| **9–10** | `2027-01-21` → `2027-02-03` | **Giai đoạn 5 & 6A** *(UX Polish, Mã hóa PII, UAT & Closed Beta trước Tết)* | Mã hóa cột nhạy cảm (`idNumber`, `bankAccountNumber`); chuẩn hóa UI/UX Expo trên Mobile/Tablet; diễn tập backup/restore; chạy **Closed Beta 20–50 user** tại 1 khu vực (giới hạn trần `≤ 500.000đ/ca`), đối soát tay song song tự động. | **Đầu vào:** Qua Cổng 4 + đủ eKYC/OTP/PSP.<br>**Cổng 5:** UAT đạt trên thiết bị iOS/Android thật; hệ thống Beta vận hành ổn định trước Tết. |
| **11** | `2027-02-04` → `2027-02-10` | **Đóng băng dịp Tết Đinh Mùi** *(~06/02/2027)* | **Không triển khai code mới**. Chỉ trực giám sát, đối soát hằng ngày, hỗ trợ người dùng Beta và đo thử backup/restore (RTO/RPO). | Đảm bảo `0` sự cố tiền bạc trong kỳ nghỉ ngân hàng. |
| **12–13** | `2027-02-11` → `2027-02-24` | **Giai đoạn 6B & 7** *(Pentest, Go/No-Go & Bàn giao)* | Kiểm thử bảo mật độc lập (Auth, IDOR, Webhook, Escrow, Upload, Admin) & vá hết lỗi `HIGH`; hoàn thiện `README.md`, OpenAPI/Swagger, Runbook; họp **Go/No-Go**; nộp App Store/Play & theo dõi Hypercare 72h. | **Cổng Go-Live (Cổng C):** Điểm `≥ 80/100`, `0` CRITICAL/HIGH, đối soát lệch `= 0` suốt 14 ngày Beta, khiếu nại `< 3%`, có xác nhận luật sư & bản thử restore thành công. |

---

## 6. NĂM VIỆC LÀM NGAY TRONG TUẦN 1 (26/11 → 03/12/2026)

| STT | Việc cần làm ngay | Hạn chót | Người phụ trách | Tiêu chí xong |
| :-: | :--- | :---: | :---: | :--- |
| 1 | **Chốt 3+1 quyết định khởi động:** (`D1`–`D4`, `D5` mô hình phí `0%`/`8%`, xử lý link `vercel.json` static) + **đặt lịch luật sư & xin tài khoản sandbox PSP/OTP**. | `2026-11-29` | Founder + Tech Lead | Có văn bản chốt quyết định + email/lịch hẹn luật sư & PSP. |
| 2 | **Bỏ mật khẩu cứng trong `docker-compose.yml`**, chuyển sang `${VAR:?required}` & quét secret toàn repo. | `2026-11-28` | DevOps / Backend | `docker compose config` sạch, không còn password literal trong git. |
| 3 | **Sửa lỗi compile & đồng bộ môi trường:** sửa `0_init/migration.sql` + `passwordHash String NOT NULL` + null-check `identity.service.ts` + sửa `GeofenceUtils` trong `application.service.ts`; cài đủ dependencies & cập nhật `package-lock.json` (`npm ci` ở root & `mobile/`). | `2026-12-01` | Backend + Mobile Dev | `npm ci`, `tsc --noEmit` (root & `mobile/`), `prisma migrate deploy` trên DB rỗng đều PASS. |
| 4 | **Nạp gói `Ledger` vào repo, vá `PaymentWebhookController` (raw body + `timingSafeEqual` + fail-closed), che dữ liệu `/jobs` & `/candidates`, thêm test HTTP/concurrency trên Postgres tạm.** | `2026-12-03` | Backend Dev | Bộ test tiền & HTTP 401/503/idempotency/concurrency chạy xanh. |
| 5 | **Viết lại `CLAUDE.md`** theo kiến trúc đồng nhất (`src/` + Expo `mobile/`, bỏ quy tắc OTP giả, tách `legacy/`). | `2026-12-03` | Tech Lead | `CLAUDE.md` khớp 100% với `IMPLEMENTATION_STATUS.md` và kiến trúc mục tiêu. |

---

## 7. CHỈ SỐ THEO DÕI HẰNG TUẦN (KPIs) & RỦI RO VẬN HÀNH

- **Chỉ số sản phẩm & tiền tệ:** Số ca ký quỹ/tuần · tỷ lệ lấp ca `< 30 phút` · thời gian trung vị nhận ca · tỷ lệ hoàn thành · tỷ lệ khiếu nại (`< 3%`) · số dòng `SUSPENSE` tồn `> 24h` (`0`) · chênh lệch đối soát (`= 0`) · p95 webhook (`< 500ms`) & `GET /jobs` (`< 300ms`) · tỷ lệ lỗi `5xx`.
- **Top 5 rủi ro cần kiểm soát xuyên suốt:**
  1. **Pháp lý giữ tiền hộ chưa rõ** → hỏi luật sư ngay Tuần 1–2; dự phòng cấu trúc qua đối tác được cấp phép.
  2. **PSP trễ sandbox / sai chữ ký webhook** → xin tài liệu & sandbox từ Tuần 1–2, test payload thật ở Tuần 3.
  3. **Thiếu nhân lực (< 3 dev)** → giữ nguyên Giai đoạn 1 & kiểm soát tiền; tạm giới hạn hạn mức giao dịch thay vì tích hợp eKYC sâu hay push nâng cao nếu thiếu người.
  4. **Kỳ nghỉ Tết (Tuần 11)** → Beta xong khâu triển khai ở Tuần 10, đóng băng release trong Tuần 11.
  5. **Cold-start cung/cầu hai phía** → Beta tập trung đúng 1 quận/khu vực, tuyển sẵn nhóm Worker nòng cốt trước khi mở Poster.
