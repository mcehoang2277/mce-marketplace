# BÁO CÁO KIỂM TOÁN TOÀN DIỆN DỰ ÁN (ENTERPRISE CTO & QA AUDIT)

- **Dự án:** MCE Marketplace — Nền Tảng Kết Nối Việc Làm Tức Thời Theo Giờ (`mce-marketplace`)
- **Kho mã nguồn:** `C:\Users\DELL\.gemini\antigravity\scratch\mce-marketplace` (`origin`: `https://github.com/mcehoang2277/mce-marketplace.git`)
- **Ngày kiểm toán:** 26/11/2026
- **Vai trò thực hiện:** Giám sát độc lập — Senior Project Director, CTO & QA Director
- **Phạm vi & Nguyên tắc:** Kiểm tra toàn bộ cấu trúc, mã nguồn, CSDL, hạ tầng, giao diện, bảo mật, kiểm thử và tài liệu; tuyệt đối không chỉnh sửa mã nguồn hay cài đặt thư viện trong đợt kiểm toán này.

---

## A. TỔNG QUAN DỰ ÁN

- **Tên dự án:** MCE Marketplace (`mce-marketplace-core` v1.1.0 / `mce-mobile` v1.0.0 / App config v2.8.0)
- **Mục tiêu cốt lõi:** Sàn kết nối việc làm theo giờ siêu địa phương (Hyperlocal On-Demand Time Marketplace) tại Việt Nam với mô hình **0% phí sàn** giai đoạn đầu, tích hợp định vị GPS/Geofence 150m chống gian lận, ký quỹ VietQR Napas 24/7, chụp ảnh nghiệm thu đóng dấu GPS/thời gian, nhắn tin/VoIP nội bộ và tích điểm uy tín Karma.
- **Công nghệ & Kiến trúc thực tế:** Hiện tồn tại **4 luồng công nghệ song song nhưng chưa hợp nhất**:
  1. **Production Target Backend (`src/`):** Node.js, TypeScript 5.4, Express 4.19, Prisma ORM 5.14 (PostgreSQL 16), JWT (`jsonwebtoken`), `bcryptjs`, `zod`.
  2. **Native Mobile Client (`mobile/`):** Expo SDK 51, React Native 0.74, React 18.2, `expo-location`, `expo-camera`, `expo-secure-store`, `lucide-react-native`.
  3. **Web PWA / Local Demo Stack (`mobile.html`, `auth.html`, `index.html`, `server.ps1`):** Single-file HTML + Tailwind CDN + Leaflet + Service Worker (`sw.js`) + PowerShell `HttpListener` lưu trữ JSON (`data/database.json`). *(Vercel static hosting trong `vercel.json` chỉ phục vụ file tĩnh `mobile.html`, `auth.html`, `manifest.json`, `sw.js`, không có API server.)*
  4. **Legacy Python Prototype (`api_server.py`):** Python `HTTPServer` + SQLite (`mce_local.db`) phục vụ `index.html` & `auth.html`.
- **Trạng thái hiện tại:** Đang ở giai đoạn **Chuyển tiếp từ Prototype sang Production Foundation** (nhánh `main` tại `390de5a`, cộng thêm các chỉnh sửa cục bộ chưa commit trên `mobile.html`, `auth.html`, `server.ps1`). Chưa sẵn sàng triển khai Production thực tế.
- **Mức độ hoàn thiện tổng thể:** **46 / 100 điểm** (Chưa đạt ngưỡng nghiệm thu).

---

## B. KIỂM SOÁT TIẾN ĐỘ & MA TRẬN HẠNG MỤC

| STT | Tên công việc / Hạng mục | Mục tiêu | Trạng thái thực tế | Tỷ lệ hoàn thành (có căn cứ) | Kết quả đã đạt được | Công việc còn thiếu | Module / Thành phần phụ trách | Mức độ ưu tiên | Thời gian dự kiến | Rủi ro & Trở ngại |
| :-: | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| 1 | Xác thực & Định danh (Auth, OTP, eKYC) | Đăng ký/đăng nhập bảo mật, OTP SMS thật, eKYC CCCD, phân quyền RBAC + Admin | **Đang thực hiện** | **45%** | Backend `src/` có JWT + `bcryptjs` + `/auth/register`, `/auth/login`, `/auth/me`; Local `mobile.html`/`auth.html`/`server.ps1` đã bỏ demo bypass và kiểm OTP/eKYC trên `database.json`. | Tích hợp SMS OTP gateway thật & eKYC OCR/Liveness backend `src/`; sửa lỗi kiểu `passwordHash` nullable trong `identity.service.ts`; bổ sung role `ADMIN` & RBAC; bảo vệ `/auth/*` bằng rate-limit thật. | `src/modules/identity/`, `src/routes/auth.routes.ts`, `auth.html`, `mobile.html` | **CRITICAL** | 5–7 ngày | Lệch giữa `server.ps1` (OTP) và `src/` (mật khẩu); chưa có SMS provider; chưa có Admin role. |
| 2 | Quản lý Ca việc & Khớp lệnh (Jobs & Matching) | Tạo ca, lọc vùng thưa dân, ứng tuyển, chủ việc duyệt & giao việc | **Đang thực hiện** | **50%** | `GET /jobs`, `POST /jobs`, `POST /jobs/:jobId/applications` chạy qua Prisma; `MatchingService` có Bounding Box + Top-K; `mobile.html` đã tính khoảng cách Haversine thực tế từ GPS cá nhân tỏa ra. | Sửa lỗi compile `GeofenceUtils` trong `application.service.ts`; mở API xem ứng viên, duyệt/từ chối/giao việc; chuyển job từ `DRAFT` sang `OPEN` sau khi nạp ký quỹ. | `src/routes/job.routes.ts`, `src/modules/matching/`, `mobile/src/screens/` | **HIGH** | 4–5 ngày | `application.service.ts` lỗi biên dịch TS2305 nên chưa dùng được ở production API. |
| 3 | Định vị Chấm công & Geofence 3 tầng | Check-in/out thực địa `≤ 150m`, sai số GPS `≤ 50m`, chống Fake GPS, ảnh e-Proof | **Đang thực hiện** | **40%** | `GeofenceService` & `GeoUtils` đã viết logic 3 tầng + có 3 unit test; `mobile.html` & `server.ps1` đã khóa check-in khi sai số `> 50m` hoặc ngoài `150m` và bắt buộc ảnh thật. | Gắn `GeofenceService` vào route API production (`src/routes/`); thay thế mock `setTimeout` + ảnh Unsplash trong `mobile/src/screens/ActiveShiftScreen.tsx` bằng API thật & upload ảnh S3/Cloud. | `src/modules/geofence/`, `mobile/src/screens/ActiveShiftScreen.tsx`, `mobile.html` | **CRITICAL** | 4–6 ngày | Expo `ActiveShiftScreen.tsx` vẫn là mock; chưa lưu `CheckEvent` xuống PostgreSQL. |
| 4 | Ký quỹ Escrow, VietQR & Ví tiền | Nạp VietQR, đối soát webhook HMAC an toàn, khóa/giải ngân/hoàn tiền ACID, rút tiền | **Bị chặn / Không đạt** | **30%** | `PostgresEscrowService` & `PaymentService` đã viết khung `prisma.$transaction`; có mô phỏng trên `server.ps1`. | Mở khóa route `/api/escrow/*` & `/api/vietqr` (đang trả `503`); **vá lỗ hổng bypass HMAC** trong `payment-webhook.controller.ts`; bỏ auto-topup ví ảo trong `lockEscrowTx`; tích hợp cổng ngân hàng thật (PayOS/SePay/Casso); mở `WalletScreen.tsx`. | `src/routes/escrow.routes.ts`, `src/routes/payment.routes.ts`, `src/modules/escrow/`, `src/modules/payments/`, `mobile/src/screens/WalletScreen.tsx` | **CRITICAL** | 7–10 ngày | Rủi ro tài chính nghiêm trọng nếu mở route khi webhook HMAC còn nhánh bypass & thiếu đối soát số tiền khớp `totalEstimatedVnd`. |
| 5 | Cơ sở dữ liệu & Migration PostgreSQL | Schema chuẩn, migration chạy sạch từ DB trống, index tối ưu | **Không đạt** | **55%** | `schema.prisma` mô hình hóa đầy đủ 10 bảng nghiệp vụ & các index chính. | Tạo lại baseline migration hoàn chỉnh từ DB rỗng (hiện `0_init` thiếu `passwordHash` và `schema.prisma` để `passwordHash String?` mâu thuẫn `NOT NULL` ở migration sau); thêm model/enum cho `ADMIN`, OTP, eKYC, Chat. | `prisma/schema.prisma`, `prisma/migrations/` | **HIGH** | 2–3 ngày | `prisma migrate deploy` trên DB trống có nguy cơ lỗi hoặc lệch schema (`docs/IMPLEMENTATION_STATUS.md` đã cảnh báo). |
| 6 | Giao diện Native Mobile (Expo) & Web PWA | Ứng dụng đồng bộ 1 nguồn API, responsive, offline/PWA ổn định | **Đang thực hiện** | **45%** | `mobile.html` chạy mượt trên `server.ps1` (khung 420px mobile-first); Expo `AuthScreen`, `ExploreScreen`, `PostJobScreen`, `ProfileScreen` đã nối API `src/`. | Đồng bộ kiến trúc: chọn Expo Native hoặc PWA làm sản phẩm chính; sửa `ActiveShiftScreen` & `WalletScreen` (Expo); xử lý lỗi Vercel static không có `/api/*`; tách `mobile.html` (4.200+ dòng) khỏi Tailwind CDN runtime. | `mobile/`, `mobile.html`, `auth.html`, `index.html`, `vercel.json` | **HIGH** | 5–8 ngày | 4 stack UI/backend khác nhau gây phân mảnh; `mobile/node_modules` chưa được cài đặt tại môi trường local. |
| 7 | Bảo mật, Phân quyền & Quản trị Admin | Bảo vệ dữ liệu cá nhân/CCCD, chống tấn công, có cổng Admin xử lý tranh chấp | **Không đạt** | **25%** | `env.ts` bỏ hardcode JWT/DB secret; `app.ts` bật CORS allow-list & giới hạn body `1mb`. | Vá bypass HMAC webhook; xóa mật khẩu DB/Redis hardcode trong `docker-compose.yml`; xây dựng tài khoản & API/UI Admin; mã hóa ảnh CCCD/e-Proof; bổ sung `helmet`, rate-limit ứng dụng, kiểm thử bảo mật. | `src/core/auth.middleware.ts`, `payment-webhook.controller.ts`, `docker-compose.yml` | **CRITICAL** | 5–7 ngày | Lộ secret mẫu Docker; bất kỳ ai gọi `/api/webhook/payment` không kèm signature đều vượt qua xác thực HMAC. |
| 8 | Kiểm thử tự động & CI/CD | Unit, Integration, API, E2E, Performance, Security & CI xanh hoàn toàn | **Không đạt** | **15%** | Có `.github/workflows/ci.yml` và 3 unit test `GeoUtils` (`tests/geo.utils.test.cjs`). | Cài đặt đủ dependencies & đồng bộ `package-lock.json` (`npm ci` lỗi do lockfile cũ); sửa lỗi compile TS; viết test cho Auth, Escrow ACID, Webhook HMAC, Geofence, API & E2E. | `tests/`, `scripts/verify_full_system.ts`, `.github/workflows/ci.yml` | **HIGH** | 5–7 ngày | Hiện `npx tsc --noEmit` thất bại (thiếu modules & lỗi `GeofenceUtils`), `dist/` chưa tồn tại, `verify_full_system.ts` chỉ kiểm tra chuỗi tĩnh. |
| 9 | Hạ tầng, Cache/Queue & Vận hành Production | Docker/Nginx/Redis/PostgreSQL chạy thật, logging/monitoring, backup | **Chưa hoàn thiện** | **35%** | Có `Dockerfile`, `docker-compose.yml`, `nginx.conf` mẫu. | Tích hợp Redis client thật vào `CacheService` & `BackgroundJobQueue` (hiện chỉ là `Map`/`setTimeout` trong RAM); sửa `nginx.conf` (đang proxy `/` vào API-only server); bỏ credential cứng trong `docker-compose.yml`; thêm structured logging & healthcheck DB/Redis. | `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `src/core/cache/`, `src/core/queue/` | **MEDIUM** | 3–5 ngày | Không thể scale ngang nhiều container vì cache, queue & `EscrowService` cũ giữ trạng thái trong RAM từng tiến trình. |
| 10 | Tài liệu & Bàn giao | Tài liệu kỹ thuật, API spec, hướng dẫn vận hành đồng nhất với mã nguồn | **Đang thực hiện** | **60%** | `docs/IMPLEMENTATION_STATUS.md` phản ánh trung thực; có `CLAUDE.md`, `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`. | Cập nhật lại `README.md`, `DEPLOY_TO_WEB_GUIDE.md` (đang mô tả sai trạng thái thực tế của `index.html`, `api_server.py` và Vercel); bổ sung OpenAPI/Swagger, Runbook sự cố & quy trình backup/restore. | `README.md`, `docs/` | **LOW** | 2 ngày | Tài liệu cũ gây hiểu nhầm rằng hệ thống đã sẵn sàng thương mại hoặc `index.html` là trang quản trị. |

**Thống kê tổng hợp (10 hạng mục):**
- **Đã hoàn thành:** 0
- **Đang thực hiện:** 5 (Hạng mục 1, 2, 3, 6, 10)
- **Chưa bắt đầu / Chưa hoàn thiện hạ tầng:** 1 (Hạng mục 9)
- **Bị chặn / Không đạt:** 4 (Hạng mục 4, 5, 7, 8)

---

## C. ĐÁNH GIÁ CHẤT LƯỢNG KỸ THUẬT, GIAO DIỆN & KIỂM THỬ

### 1. Kiểm tra kỹ thuật & Mã nguồn
- **Kiến trúc hệ thống:** Ý tưởng Modular Monolith trong `src/modules/` tốt, nhưng **bị phân mảnh nghiêm trọng**: cùng một dự án lại chứa đồng thời backend TypeScript (`src/`), backend Python (`api_server.py`), backend PowerShell (`server.ps1`), ứng dụng Expo (`mobile/`), và 3 giao diện web rời (`mobile.html`, `auth.html`, `index.html`).
- **Biên dịch & Dependencies:**
  - Chạy `npx tsc --noEmit -p tsconfig.json` trực tiếp trong môi trường hiện tại **thất bại**: `node_modules` cục bộ thiếu các gói cốt lõi (`express`, `cors`, `@prisma/client`, `bcryptjs`, `jsonwebtoken`, `zod`), `dist/` chưa được build, `mobile/node_modules` chưa tồn tại.
  - **Lỗi code ngay cả khi đủ thư viện:** `src/modules/matching/application.service.ts` dòng 3 import `{ GeofenceUtils }` từ `../../core/utils/geo.utils` (thực tế file chỉ export `GeoUtils`), và dòng 60 gọi `GeofenceUtils.calculateHaversineDistance(...)` không tồn tại. Ngoài ra, `src/modules/identity/identity.service.ts` dòng 81 truyền `record.passwordHash` (`string | null` theo `schema.prisma`) thẳng vào `bcrypt.compare(password, record.passwordHash)` gây lỗi kiểu TS strict và tiềm ẩn lỗi runtime nếu null.
- **Database & Migration:** `0_init/migration.sql` + `20261125000100_add_user_password_hash/migration.sql` không tương thích toàn phần với `schema.prisma` (`passwordHash` là `String?` trong schema nhưng `NOT NULL` trong migration). Tài liệu nội bộ `docs/IMPLEMENTATION_STATUS.md` cũng xác nhận không thể chạy `prisma migrate deploy` trên DB trống.
- **Cache, Queue & Khả năng mở rộng:** `CacheService` (`src/core/cache/cache.service.ts`) chỉ dùng `Map` nội bộ dù comment ghi "Redis phân tán"; `BackgroundJobQueue` (`src/core/queue/job.queue.ts`) chỉ dùng mảng RAM + `setTimeout`, mất toàn bộ tác vụ nếu server restart và không thể chạy multi-instance.
- **Bảo mật & Phân quyền:**
  - **Lỗ hổng CRITICAL trong `src/modules/payments/payment-webhook.controller.ts` (dòng 37–51):** Nhánh `if (signature && ENV.WEBHOOK_HMAC_SECRET) { ... } else { isVerified = true; }` cho phép kẻ tấn công chỉ cần **bỏ trống header `x-webhook-signature`** (hoặc server thiếu `WEBHOOK_HMAC_SECRET`) là qua mặt kiểm tra chữ ký HMAC, kết hợp `job.findFirst({ id: { contains: jobId } })` và `lockEscrowTx` tự động cộng tiền ví nếu thiếu số dư!
  - **Lộ thông tin cấu hình trong `docker-compose.yml`:** Chứa mật khẩu cố định `mce_secure_password_2026` (PostgreSQL) và `mce_redis_secret_2026` (Redis), thiếu `JWT_SECRET`.
  - **Thiếu tài khoản & phân quyền `ADMIN`:** Cả `prisma/schema.prisma`, `auth.middleware.ts`, `auth.routes.ts`, `server.ps1` và UI đều chưa có role `ADMIN` thật; code chỉ kiểm tra chuỗi `'SYSTEM_ADMIN'`.

### 2. Kiểm tra giao diện & Trải nghiệm người dùng (UI/UX)
- **Web Prototype (`mobile.html` & `auth.html` trên `server.ps1`):**
  - Giao diện di động (`mobile.html`) dark-mode rõ ràng, hỗ trợ Leaflet map, bộ lọc bán kính/ngành nghề, quét tỏa từ vị trí GPS cá nhân thực tế và chặn chấm công khi sai số GPS `> 50m` hoặc ngoài `150m`. Đã được loại bỏ các bypass demo ở Auth/eKYC/Camera Proof.
  - **Điểm yếu:** `mobile.html` là single-file quá lớn (~4.200 dòng), tải Tailwind CSS qua CDN runtime (chậm trên mạng 3G/4G yếu), `sw.js` dùng biểu tượng/cache tĩnh lẫn URL ngoài (`cdn.tailwindcss.com`, `unpkg.com`), và trên `vercel.json` cấu hình pure static nên mọi gọi API `/api/*` ở môi trường Vercel live sẽ bị định tuyến về `mobile.html` thay vì JSON backend.
- **Expo Native App (`mobile/`):**
  - `AuthScreen.tsx`, `ExploreScreen.tsx`, `PostJobScreen.tsx`, `ProfileScreen.tsx` đã nối tới API `src/`.
  - Tuy nhiên **`ActiveShiftScreen.tsx` vẫn là giao diện giả lập hoàn toàn** (dùng `setTimeout` cho check-in, tọa độ cứng `21.0285, 105.8544`, khoảng cách cứng `25 mét`, ảnh Unsplash cố định, tự báo giải ngân `240.000 VNĐ`); `WalletScreen.tsx` chỉ là màn hình thông báo tạm khóa.
- **Desktop (`index.html`):** Tài liệu `DEPLOY_TO_WEB_GUIDE.md` mô tả là "Bản Quản trị", nhưng thực tế chỉ là bản desktop của Worker/Poster, chưa có chức năng quản trị hay đối chiếu với `src/` API.

### 3. Kết quả kiểm thử theo 7 cấp độ

| Cấp độ kiểm thử | Trạng thái hiện tại | Bằng chứng cụ thể |
| :--- | :---: | :--- |
| **1. Unit Testing** | **Chưa đạt** | Chỉ có 3 test trong `tests/geo.utils.test.cjs` cho `GeoUtils`; hiện tại không chạy được tại local vì thiếu `dist/` và thiếu dependencies. |
| **2. Integration Testing** | **Chưa có** | 0 test tích hợp với PostgreSQL / Prisma `$transaction` / Redis. |
| **3. API Testing** | **Thủ công một phần (chỉ prototype)** | Đã kiểm thử bằng trình duyệt trên `server.ps1` (`POST /api/auth/otp/send`, `/api/auth/login`, `/api/wallet/transactions`); Backend chính `src/` chưa có bộ API test tự động. |
| **4. End-to-End Testing** | **Thủ công một phần (chỉ prototype)** | Đã kiểm thử luồng Login OTP -> eKYC gate -> Apply -> Radar/Check-in block trên `mobile.html` + `server.ps1`; chưa có kịch bản E2E tự động (Playwright/Detox) và chưa test luồng từ DB đến Expo. |
| **5. Regression Testing** | **Chưa có** | `scripts/verify_full_system.ts` chỉ kiểm tra tồn tại file & khớp chuỗi, không kiểm tra hành vi hồi quy. |
| **6. Performance Testing** | **Chưa có** | Chưa có benchmark tải đồng thời (k6/Artillery) cho matching, webhook hoặc DB locks. |
| **7. Security Testing** | **Không đạt** | Phát hiện lỗ hổng bypass HMAC ở `PaymentWebhookController`, mật khẩu cứng ở `docker-compose.yml`, thiếu rate-limit ứng dụng và chưa có penetration/SAST check. |

---

## D. CHẤM ĐIỂM SẢN PHẨM CUỐI CÙNG (THANG 100 ĐIỂM)

| STT | Tiêu chí đánh giá | Điểm tối đa | Điểm đạt | Căn cứ chấm điểm thực tế |
| :-: | :--- | :---: | :---: | :--- |
| 1 | Mức độ hoàn thiện chức năng | 20 | **9** | `src/` mới mở Auth + tạo Job `DRAFT` + Apply; Escrow/VietQR trả `503`; thiếu Assignment/Check-in/Check-out/Wallet/Admin API. Prototype `mobile.html` + `server.ps1` đầy đủ hơn nhưng chỉ là bản cục bộ. |
| 2 | Chất lượng mã nguồn & kiến trúc | 15 | **7** | Phân tách module ở `src/` khá gọn nhưng 4 stack chồng chéo; `application.service.ts` lỗi compile; `identity.service.ts` lỗi kiểu `passwordHash`; `CacheService`/`Queue` chưa nối Redis thật. |
| 3 | Hiệu năng & tốc độ | 15 | **8** | Có tư duy tối ưu tốt (`GeoUtils` Bounding Box, `MatchingService` Top-K, Prisma indexes, Nginx gzip); trừ điểm do chưa có Redis thật, `mobile.html` 4.200+ dòng dùng Tailwind CDN và chưa đo tải thực tế. |
| 4 | Giao diện & trải nghiệm người dùng | 10 | **6** | `mobile.html` có bản đồ Leaflet, quét GPS cá nhân và UX rõ ràng; nhưng trải nghiệm giữa `mobile.html`, `index.html` và Expo `mobile/` không đồng nhất, Expo `ActiveShiftScreen` còn giả lập. |
| 5 | Bảo mật & an toàn dữ liệu | 15 | **6** | Có JWT/bcrypt, CORS allow-list, bỏ fallback secret ở `env.ts` và bỏ bypass ở `mobile.html`/`server.ps1`; nhưng `PaymentWebhookController` có lỗ hổng bypass HMAC nghiêm trọng, thiếu `ADMIN` RBAC, `docker-compose.yml` lộ secret. |
| 6 | Kiểm thử & độ ổn định | 10 | **2** | Chỉ có 3 unit test `GeoUtils`; `tsc --noEmit` lỗi; `package-lock.json` lệch; 0 integration/API/security/E2E test tự động cho backend chính. |
| 7 | Khả năng mở rộng | 10 | **5** | Có blueprint Docker/Nginx nhưng stateful in-memory ở `CacheService`, `BackgroundJobQueue`, `EscrowService` cũ và `server.ps1` JSON file cản trở scale ngang. |
| 8 | Tài liệu & khả năng bàn giao | 5 | **3** | `IMPLEMENTATION_STATUS.md` và `CLAUDE.md` rõ ràng, trung thực; nhưng `README.md` và `DEPLOY_TO_WEB_GUIDE.md` còn mô tả sai lệch với trạng thái code thực tế. |
| | **TỔNG ĐIỂM** | **100** | **46** | **Chưa đạt chuẩn Production Enterprise** |

---

## E. SỔ ĐĂNG KÝ RỦI RO & KHẮC PHỤC (RISK REGISTER)

### 1. [CRITICAL-01] Lỗ hổng Bypass Xác thực HMAC Webhook Thanh toán & Khóa cọc Ảo
- **Mô tả lỗi:** Trong `src/modules/payments/payment-webhook.controller.ts` (dòng 37–51), nếu header `x-webhook-signature` bị bỏ trống hoặc `ENV.WEBHOOK_HMAC_SECRET` rỗng, điều kiện `if (signature && ENV.WEBHOOK_HMAC_SECRET)` rơi vào nhánh `else { isVerified = true; }`. Tiếp theo, `lockEscrowTx` tự động cộng tiền ảo vào ví Poster nếu số dư nhỏ hơn `amount`, và không kiểm tra `amount >= job.totalEstimatedVnd`.
- **Nguyên nhân gốc rễ:** Nhánh fallback "môi trường thử nghiệm" bị để lại trong controller production, cộng với việc tìm job bằng `{ contains: jobId }` và so sánh chữ ký bằng `!==` thay vì `crypto.timingSafeEqual`.
- **Mức độ ảnh hưởng:** Kẻ tấn công bất kỳ có thể gửi `POST /api/webhook/payment` không cần chữ ký để giả lập nạp tiền VietQR, khóa cọc ảo và mở `Job` lên `OPEN` mà không tốn 1 đồng.
- **Phương án khắc phục:** Bắt buộc fail-closed: từ chối `503` nếu thiếu `WEBHOOK_HMAC_SECRET`, từ chối `401` nếu thiếu hoặc sai `signature` (dùng `crypto.timingSafeEqual` trên raw request body buffer); tìm job khớp chính xác ID/referenceCode; kiểm tra `amount` đúng theo đơn thanh toán; loại bỏ cơ chế tự cộng tiền ví ảo trong `lockEscrowTx`.
- **Chi phí & độ phức tạp:** Trung bình (1–2 ngày kỹ thuật).
- **Tiêu chí xác nhận đã khắc phục:** Test tự động xác nhận request không chữ ký trả `401`, sai chữ ký trả `401`, chữ ký hợp lệ chỉ xử lý đúng 1 lần (idempotent) và số tiền khớp đơn hàng.

### 2. [CRITICAL-02] Lỗi Biên dịch TypeScript & Sai lệch Dependencies (`src/` và `mobile/`)
- **Mô tả lỗi:** `src/modules/matching/application.service.ts` lỗi TS2305 (`GeofenceUtils` không tồn tại trong `geo.utils.ts`); `src/modules/identity/identity.service.ts` truyền `string | null` vào `bcrypt.compare`; `node_modules` cục bộ thiếu dependencies sản xuất, `mobile/node_modules` chưa cài, `package-lock.json` bị lệch (`IMPLEMENTATION_STATUS.md`).
- **Nguyên nhân gốc rễ:** Hợp nhất nhánh (`f4b87c4`) không chạy kiểm tra toàn bộ module hoặc chưa cài đặt đồng bộ sau merge; `application.service.ts` không được import từ `routes/` nên lỗi bị ẩn trên một số cấu hình hoặc khi thiếu `node_modules`.
- **Mức độ ảnh hưởng:** Không thể build sạch `dist/` để chạy backend TypeScript hoặc deploy Docker ổn định.
- **Phương án khắc phục:** Sửa `application.service.ts` dùng `GeoUtils.calculateDistanceMeters`, kiểm tra null cho `record.passwordHash` trước `bcrypt.compare`, đồng bộ `npm install` + commit `package-lock.json` sạch cho cả root và `mobile/`, chạy `npm ci` + `npx tsc --noEmit` trên cả 2 workspace.
- **Chi phí & độ phức tạp:** Thấp (0.5–1 ngày).
- **Tiêu chí xác nhận đã khắc phục:** `npm ci && npm run build && npm test` ở root và `npm ci && npx tsc --noEmit` ở `mobile/` đạt exit code `0` với zero errors.

### 3. [CRITICAL-03] Chức năng Escrow, Chấm công, Giải ngân, Ví tiền & Admin bị Khóa/Thiếu trên API Chính
- **Mô tả lỗi:** `escrowRouter` trả `503` cho mọi hành động; `paymentRouter` trả `503` cho `/vietqr`; `jobRouter` thiếu hoàn toàn API xem ứng viên, nhận/từ chối ứng viên, check-in, check-out, khiếu nại và rút tiền; không có role `ADMIN` trong schema/middleware/routes; Expo `ActiveShiftScreen.tsx` vẫn dùng mock data.
- **Nguyên nhân gốc rễ:** Backend mới hoàn thiện phần khung Auth và Draft Job sau khi gỡ bỏ các logic in-memory cũ; chưa hợp nhất luồng từ prototype `server.ps1` sang `src/`.
- **Mức độ ảnh hưởng:** Ứng dụng sản phẩm chính (`src/` + `mobile/`) không thể vận hành quy trình việc làm từ đầu đến cuối.
- **Phương án khắc phục:** Nối `ApplicationService`, `GeofenceService`, `PostgresEscrowService`, `PaymentService` vào Express routes có `requireAuth`/`requireRole`; bổ sung model/API Check-in/Check-out lưu `CheckEvent` + upload ảnh minh chứng có signed URL; bổ sung role `ADMIN` & API xử lý tranh chấp/giải ngân.
- **Chi phí & độ phức tạp:** Cao (10–14 ngày).
- **Tiêu chí xác nhận đã khắc phục:** Test tích hợp E2E chạy trọn vòng đời `Register -> eKYC -> Post Job -> VietQR Lock -> Apply -> Assign -> Geofence Check-in -> Photo Check-out -> Escrow Release -> Withdraw` trên PostgreSQL thật.

### 4. [HIGH-01] Migration Prisma Không Chạy Được Trên Cơ Sở Dữ Liệu Trống
- **Mô tả lỗi:** `0_init/migration.sql` không khớp `schema.prisma` (`User.passwordHash` là `String?` ở schema nhưng `NOT NULL` ở migration thứ hai); chưa có bảng/cột cho OTP, chi tiết eKYC hay `UserRole.ADMIN`.
- **Nguyên nhân gốc rễ:** Chỉnh sửa `schema.prisma` không sinh migration đồng nhất từ đầu.
- **Mức độ ảnh hưởng:** Triển khai mới môi trường staging/production bị lỗi hoặc sai ràng buộc dữ liệu.
- **Phương án khắc phục:** Tạo baseline migration sạch đã rà soát kỹ cho DB rỗng, chuẩn hóa `passwordHash String` (hoặc xử lý đúng nullable), bổ sung migration cho `ADMIN` và kiểm thử `prisma migrate deploy` trên PostgreSQL mới tinh trong Docker.
- **Chi phí & độ phức tạp:** Thấp–Trung bình (1–2 ngày).
- **Tiêu chí xác nhận đã khắc phục:** Chạy `npx prisma migrate deploy` trên PostgreSQL rỗng thành công 100%, không drift (`npx prisma migrate status`).

### 5. [HIGH-02] Lộ Thông Tin Nhạy Cảm Trong Cấu Hình Docker & Kiến Trúc Nginx Sai Đích
- **Mô tả lỗi:** `docker-compose.yml` ghi cứng `mce_secure_password_2026` và `mce_redis_secret_2026`, thiếu `JWT_SECRET`; `nginx.conf` proxy `/` sang `app:8000` vốn chỉ phục vụ `/api/*` và thiếu cấu hình TLS/HTTPS. Trong khi đó `vercel.json` chỉ deploy file tĩnh nên mọi gọi `/api/*` trên web live đều thất bại.
- **Nguyên nhân gốc rễ:** Tập tin hạ tầng tạo cho demo chưa cập nhật đồng bộ khi `src/app.ts` chuyển sang API-only và frontend tách thành Expo + static HTML.
- **Mức độ ảnh hưởng:** Rủi ro lộ credential, lỗi 404 toàn trang trên Nginx, và web live trên Vercel không kết nối được backend.
- **Phương án khắc phục:** Chuyển toàn bộ mật khẩu trong `docker-compose.yml` sang `${VAR:?required}` từ `.env` bảo mật; tách rõ Nginx phục vụ static/SPA + proxy `/api/` hoặc cấu hình domain API riêng cho Vercel (`API_BASE_URL`) kèm HTTPS (TLS 1.2/1.3).
- **Chi phí & độ phức tạp:** Trung bình (1–2 ngày).
- **Tiêu chí xác nhận đã khắc phục:** Quét secret scan không còn mật khẩu cứng; `docker compose config` & kiểm thử qua Nginx trả đúng trang web + JSON `/api/health` qua HTTPS.

### 6. [HIGH-03] Phân Mảnh 4 Stack Song Song (`src/`, `server.ps1`, `api_server.py`, `mobile/` + `mobile.html`)
- **Mô tả lỗi:** Nghiệp vụ và giao diện bị nhân bản ở nhiều nơi với quy tắc khác nhau (ví dụ: `mobile.html` vs `mobile/` Expo, `server.ps1` JSON vs `api_server.py` SQLite vs `src/` PostgreSQL).
- **Nguyên nhân gốc rễ:** Phát triển nhanh qua nhiều giai đoạn (prototype PowerShell/Python, web HTML, rồi chuyển hướng sang TypeScript + Expo) nhưng chưa dọn dẹp hoặc đóng băng bản cũ.
- **Mức độ ảnh hưởng:** Tốn gấp đôi–ba lần công bảo trì, dễ sửa lỗi ở chỗ này nhưng bỏ sót chỗ khác (như lỗ hổng/mock còn sót ở `ActiveShiftScreen.tsx`).
- **Phương án khắc phục:** Chốt **một kiến trúc nguồn chân lý duy nhất**: Backend TypeScript (`src/`) + PostgreSQL/Redis; chọn rõ Expo Native (`mobile/`) là app chính và Web PWA kết nối cùng API `src/`; lưu trữ/đóng băng `api_server.py` và `server.ps1` vào thư mục `legacy/` hoặc chỉ dùng cho sandbox offline có gắn cờ rõ ràng.
- **Chi phí & độ phức tạp:** Trung bình (2–3 ngày quy hoạch & chuyển dịch).
- **Tiêu chí xác nhận đã khắc phục:** Mọi client (Expo & Web) gọi cùng bộ API `src/` và không còn logic nghiệp vụ trùng lặp ở script phụ.

### 7. [MEDIUM-01] CacheService & BackgroundJobQueue Chưa Kết Nối Redis Thật
- **Mô tả lỗi:** `CacheService` chỉ dùng `Map` trong RAM; `BackgroundJobQueue` chỉ dùng `setTimeout` trong bộ nhớ tiến trình.
- **Nguyên nhân gốc rễ:** Cài đặt khung giao diện lớp nhưng chưa cài `ioredis`/`bullmq` và chưa nối container `redis` trong `docker-compose.yml`.
- **Mức độ ảnh hưởng:** Mất job hàng đợi khi khởi động lại app; không đồng bộ idempotency/cache/OTP nếu chạy từ 2 instance trở lên.
- **Phương án khắc phục:** Tích hợp `ioredis` (hoặc BullMQ cho queue giải ngân tự động/push notification) có fallback an toàn và cấu hình qua `REDIS_URL`.
- **Chi phí & độ phức tạp:** Trung bình (2–3 ngày).
- **Tiêu chí xác nhận đã khắc phục:** Tác vụ queue vẫn tồn tại sau khi restart worker Node.js; hai instance API đọc cùng cache Redis.

### 8. [MEDIUM-02] Tối Ưu Tải Web PWA (`mobile.html`) & Bảo Đảm Dữ Liệu Ảnh Minh Chứng
- **Mô tả lỗi:** `mobile.html` dài >4.200 dòng gộp toàn bộ CSS/JS inline và dùng Tailwind Play CDN runtime; `server.ps1` lưu ảnh base64 vào thư mục local `proofs/` không phân quyền truy cập; `src/` chưa có dịch vụ lưu trữ đối tượng (S3/R2).
- **Nguyên nhân gốc rễ:** Thiết kế single-file để chạy nhanh ban đầu.
- **Mức độ ảnh hưởng:** Tải trang ban đầu nặng trên thiết bị cấu hình thấp; dữ liệu CCCD và ảnh nghiệm thu không được bảo vệ quyền truy cập (signed URL).
- **Phương án khắc phục:** Tách cấu phần tĩnh/build CSS tối giản cho web hoặc chuyển hẳn luồng người dùng chính sang Expo build; lưu ảnh CCCD/e-Proof trên Object Storage riêng tư với pre-signed URL có thời hạn.
- **Chi phí & độ phức tạp:** Trung bình (3–4 ngày).
- **Tiêu chí xác nhận đã khắc phục:** Chỉ số Lighthouse Mobile Performance ≥ 85; ảnh nhạy cảm không truy cập công khai trực tiếp qua URL tĩnh.

### 9. [LOW-01] Tài Liệu Kỹ Thuật Không Đồng Nhất Với Code Hiện Tại
- **Mô tả lỗi:** `README.md`, `DEPLOY_TO_WEB_GUIDE.md` vẫn hướng dẫn chạy `index.html` như "Bản Quản trị" và mô tả tính năng chưa kích hoạt trên `src/`; `mobile/eas.json` còn Apple/Google ID giữ chỗ.
- **Nguyên nhân gốc rễ:** Tài liệu không được cập nhật đồng bộ sau các commit tái cấu trúc.
- **Mức độ ảnh hưởng:** Gây nhầm lẫn cho đội vận hành và kỹ sư tiếp nhận bàn giao.
- **Phương án khắc phục:** Cập nhật `README.md`, bổ sung OpenAPI spec, cập nhật `DEPLOY_TO_WEB_GUIDE.md` và điền metadata store thật trước khi phát hành.
- **Chi phí & độ phức tạp:** Thấp (1 ngày).
- **Tiêu chí xác nhận đã khắc phục:** 100% lệnh hướng dẫn trong `README.md` chạy đúng thực tế.

---

## F. KẾ HOẠCH ĐIỀU HÀNH THEO 7 GIAI ĐOẠN

### Giai đoạn 1: Khắc phục lỗi nghiêm trọng (Security, Build & Migration)
- **Mục tiêu:** Đảm bảo mã nguồn biên dịch sạch, đóng kín lỗ hổng tài chính và chuẩn hóa migration CSDL.
- **Danh sách nhiệm vụ:**
  1. Vá lỗ hổng bypass HMAC trong `PaymentWebhookController` (fail-closed, `timingSafeEqual`, đối chiếu khớp số tiền & mã job chính xác).
  2. Sửa lỗi `GeofenceUtils` trong `application.service.ts` và null-check `passwordHash` trong `identity.service.ts`.
  3. Đồng bộ `npm install` + `package-lock.json` cho root và `mobile/`; sửa baseline Prisma migration cho DB trống.
  4. Xóa mật khẩu cứng trong `docker-compose.yml`, chuyển sang biến môi trường bắt buộc.
- **Mức độ ưu tiên:** P0 — Bắt buộc làm ngay.
- **Điều kiện đầu vào:** Báo cáo kiểm toán được phê duyệt; thống nhất giữ `src/` làm backend duy nhất.
- **Kết quả đầu ra:** Repo build xanh, zero TS error, migration chạy sạch trên PostgreSQL rỗng, webhook an toàn.
- **Tiêu chí nghiệm thu:** `npx tsc --noEmit` (root & mobile), `prisma migrate deploy` trên DB mới, và unit test bảo mật webhook đều PASS.
- **Điều kiện chuyển giai đoạn:** Toàn bộ lỗi CRITICAL-01, CRITICAL-02, HIGH-01, HIGH-02 được đóng và kiểm chứng.

### Giai đoạn 2: Hoàn thiện chức năng cốt lõi còn thiếu
- **Mục tiêu:** Đưa toàn bộ vòng đời nghiệp vụ thật vào API `src/` và client `mobile/` (và web nếu giữ).
- **Danh sách nhiệm vụ:**
  1. Mở và hoàn thiện các routes: xem ứng viên, chấp nhận/từ chối/giao việc (`ApplicationService`), check-in/check-out (`GeofenceService` + `CheckEvent`), upload ảnh e-Proof (Object Storage).
  2. Hoàn thiện luồng VietQR + `PostgresEscrowService` (khóa cọc khi đủ tiền, giải ngân 100%, hoàn tiền, khiếu nại, rút tiền) và mở lại `/api/escrow/*`, `/api/vietqr`.
  3. Tích hợp SMS OTP provider & quy trình eKYC backend.
  4. Bổ sung role `ADMIN`, middleware `requireAdmin` và API/trang quản trị xử lý tranh chấp, duyệt eKYC, đối soát giao dịch.
  5. Thay thế hoàn toàn mock trong `mobile/src/screens/ActiveShiftScreen.tsx` & `WalletScreen.tsx` bằng API thật.
- **Mức độ ưu tiên:** P0 / P1.
- **Điều kiện đầu vào:** Giai đoạn 1 hoàn tất nghiệm thu.
- **Kết quả đầu ra:** Luồng End-to-End chạy hoàn toàn trên dữ liệu PostgreSQL thật.
- **Tiêu chí nghiệm thu:** Không còn màn hình nào trong `mobile/` hoặc web chính dùng dữ liệu giả hay trả `503`.
- **Điều kiện chuyển giai đoạn:** Hoàn thành 100% tính năng MVP cam kết và chạy thông suốt luồng chính.

### Giai đoạn 3: Tối ưu hiệu năng, Cache/Queue & Kiến trúc
- **Mục tiêu:** Sẵn sàng chịu tải và mở rộng ngang (horizontal scaling).
- **Danh sách nhiệm vụ:**
  1. Kết nối Redis thật cho `CacheService` và BullMQ/Redis cho `BackgroundJobQueue` (auto-release sau 24h, push notification).
  2. Áp dụng rate-limiting trên Express (`express-rate-limit` dùng Redis store) + `helmet` bảo mật HTTP headers.
  3. Bổ sung cursor/limit pagination cho danh sách việc làm, giao dịch, ứng viên; tối ưu truy vấn không gian (PostGIS hoặc bounding box index).
  4. Lưu trữ `api_server.py` và `server.ps1` vào nhánh/thư mục tham khảo rõ ràng để tránh phân mảnh.
- **Mức độ ưu tiên:** P1.
- **Điều kiện đầu vào:** Giai đoạn 2 hoàn tất.
- **Kết quả đầu ra:** Hệ thống stateless hoàn toàn ở tầng Node.js API.
- **Tiêu chí nghiệm thu:** Chạy được 2+ replica `app` container qua Nginx + Redis + PostgreSQL mà không mất trạng thái.
- **Điều kiện chuyển giai đoạn:** Kiểm chứng chạy multi-instance & không có truy vấn N+1/memory leak.

### Giai đoạn 4: Kiểm thử toàn diện (7 cấp độ)
- **Mục tiêu:** Đảm bảo chất lượng bằng bằng chứng tự động trước khi đưa ra thị trường.
- **Danh sách nhiệm vụ:**
  1. Unit Test (coverage ≥ 80% các service nghiệp vụ: GeoUtils, Geofence, Matching, Escrow math, Auth).
  2. Integration Test với PostgreSQL & Redis container thật (kiểm thử concurrency khóa/giải ngân/rút tiền chống race condition & âm ví).
  3. API Contract Test & Regression Test thay cho `verify_full_system.ts` tĩnh.
  4. E2E Test tự động luồng Worker/Poster/Admin.
  5. Performance Test (k6/Artillery đạt mục tiêu P95 < 300ms ở tải dự kiến) & Security Audit (OWASP API Top 10, HMAC, RBAC, IDOR).
- **Mức độ ưu tiên:** P0 / P1.
- **Điều kiện đầu vào:** Giai đoạn 3 hoàn tất.
- **Kết quả đầu ra:** Bộ test tự động chạy trên CI và báo cáo tải/bảo mật.
- **Tiêu chí nghiệm thu:** 100% test pass trên CI, 0 lỗi CRITICAL/HIGH còn mở.
- **Điều kiện chuyển giai đoạn:** Ký xác nhận QA Sign-off.

### Giai đoạn 5: Hoàn thiện giao diện & trải nghiệm (UI/UX)
- **Mục tiêu:** Đồng nhất trải nghiệm Mobile/Web, tối ưu responsive và loại bỏ tài sản giữ chỗ.
- **Danh sách nhiệm vụ:**
  1. Đồng bộ UI/UX màn hình bản đồ, ca làm việc, ví tiền, chat/thông báo trên Expo Native (và bản Web PWA nếu phát hành song song).
  2. Kiểm tra responsive trên kích thước Mobile (360px–430px), Tablet (768px–1024px) và Desktop (1280px+).
  3. Loại bỏ Tailwind CDN runtime ở bản Web production (build CSS tĩnh), tối ưu kích thước bundle và trạng thái loading/empty/error rõ ràng.
- **Mức độ ưu tiên:** P2.
- **Điều kiện đầu vào:** Giai đoạn 4 đạt QA Sign-off.
- **Kết quả đầu ra:** Giao diện đồng nhất, mượt, không còn lỗi hiển thị hay luồng cụt.
- **Tiêu chí nghiệm thu:** Hoàn tất UAT checklist trên thiết bị thật iOS, Android và trình duyệt Desktop/Mobile.
- **Điều kiện chuyển giai đoạn:** Product Owner phê duyệt UAT.

### Giai đoạn 6: Chuẩn bị triển khai Production
- **Mục tiêu:** Sẵn sàng hạ tầng, bảo mật vận hành và phát hành store.
- **Danh sách nhiệm vụ:**
  1. Thiết lập môi trường Staging & Production (VPS/Cloud, HTTPS/TLS, WAF/Nginx, firewall DB/Redis nội bộ).
  2. Thiết lập backup PostgreSQL tự động hằng ngày, kiểm thử restore, giám sát log tập trung & cảnh báo (uptime, error rate, webhook fail).
  3. Cập nhật `mobile/app.json` & `mobile/eas.json` bằng tài khoản Apple/Google thật, cấu hình `EXPO_PUBLIC_API_URL` HTTPS production; tách rõ Vercel/Web backend API URL.
- **Mức độ ưu tiên:** P1.
- **Điều kiện đầu vào:** Giai đoạn 5 hoàn tất UAT.
- **Kết quả đầu ra:** Môi trường Staging/Production chạy ổn định kèm kế hoạch rollback.
- **Tiêu chí nghiệm thu:** Diễn tập deploy & rollback thành công; xác nhận đối soát chuyển khoản VietQR thật với số tiền nhỏ (10.000đ).
- **Điều kiện chuyển giai đoạn:** Change Advisory / CTO phê duyệt Go-Live.

### Giai đoạn 7: Nghiệm thu & Bàn giao sản phẩm
- **Mục tiêu:** Bàn giao đầy đủ mã nguồn, tài liệu vận hành và chuyển giao cho đội vận hành.
- **Danh sách nhiệm vụ:**
  1. Cập nhật đồng bộ `README.md`, OpenAPI/Swagger, tài liệu kiến trúc và Runbook xử lý sự cố/tranh chấp Admin.
  2. Bàn giao khóa/quyền quản trị theo nguyên tắc tối thiểu đặc quyền (Least Privilege).
  3. Theo dõi sát 72 giờ đầu sau Go-Live (Hypercare).
- **Mức độ ưu tiên:** P2.
- **Điều kiện đầu vào:** Giai đoạn 6 Go-Live thành công.
- **Kết quả đầu ra:** Bộ hồ sơ nghiệm thu hoàn chỉnh & hệ thống vận hành ổn định.
- **Tiêu chí nghiệm thu:** Không phát sinh sự cố P0/P1 trong giai đoạn Hypercare; ký biên bản nghiệm thu bàn giao.
- **Điều kiện chuyển giai đoạn:** Kết thúc bàn giao dự án.

---

## G. BÁO CÁO ĐIỀU HÀNH: NHỮNG GÌ HOẠT ĐỘNG / CHƯA HOẠT ĐỘNG & KẾ HOẠCH HÀNH ĐỘNG

### 1. Đánh giá thực tế sản phẩm cuối
- **Những gì đã thực sự hoạt động (có kiểm chứng):**
  - Bản prototype cục bộ (`server.ps1` + `mobile.html` + `auth.html`) hoạt động ổn định trên `http://localhost:3000/`, đã xử lý quét GPS cá nhân tỏa ra xung quanh và chặn chấm công/OTP/eKYC/camera proof sai quy chuẩn.
  - Ở backend `src/`: khung Express, `env.ts`, `auth.middleware.ts`, `auth.routes.ts`, `job.routes.ts` (`GET /jobs`, `POST /jobs`, `POST /jobs/:jobId/applications`), `GeoUtils`, `GeofenceService`, `MatchingService`, `PostgresEscrowService` được thiết kế có cấu trúc rõ ràng.
- **Những gì chưa hoạt động / còn là giữ chỗ:**
  - Toàn bộ nhánh Escrow (`/api/escrow/*`) và VietQR (`/api/vietqr`) trên `src/` đang khóa cứng `503`.
  - `ApplicationService` lỗi biên dịch TypeScript (`GeofenceUtils`), chưa gắn route.
  - Expo `ActiveShiftScreen.tsx` & `WalletScreen.tsx` chưa kết nối backend (còn mock/tạm khóa).
  - Chưa có tài khoản & giao diện/API quản trị (`ADMIN`), chưa có SMS OTP thật, chưa có cổng ngân hàng thật, chưa có Redis thật.
  - Web deploy qua `vercel.json` là static thuần nên mọi lời gọi `/api/*` không có backend xử lý.
- **Những gì chưa được kiểm thử:**
  - Chưa chạy bất kỳ kiểm thử thực tế nào trên PostgreSQL/Redis thật, concurrency ví tiền/escrow, tải cao, thiết bị di động thật Android/iOS, hoặc kiểm thử xâm nhập bảo mật (PenTest).
- **Khả năng đưa vào Production hiện tại:** **CHƯA THỂ ĐƯA VÀO PRODUCTION.**

### 2. Kế hoạch hành động tóm tắt
- **Việc cần làm ngay (Tuần 1):**
  1. Vá lỗ hổng bypass HMAC ở `PaymentWebhookController` và xóa mật khẩu cứng ở `docker-compose.yml`.
  2. Sửa lỗi compile ở `application.service.ts` và `identity.service.ts`; đồng bộ `node_modules` + `package-lock.json` và tạo baseline migration DB sạch.
  3. Chốt kiến trúc nguồn chân lý duy nhất (`src/` + Expo `mobile/` hoặc PWA nối cùng API `src/`).
- **Việc cần làm tiếp theo (Tuần 2–4):**
  1. Nối hoàn chỉnh Assignment, Geofence Check-in/out, e-Proof storage, VietQR + PostgresEscrow, Withdraw và Admin portal vào `src/`.
  2. Tích hợp Redis thật cho cache/queue và viết đủ bộ Integration/API/Security tests.
- **Việc có thể trì hoãn (Sau Pilot ổn định):**
  1. Tối ưu mở rộng đa vùng, bảng phân tích BI nâng cao, tính năng mở rộng cho đối tác doanh nghiệp.

---

## H. KẾT LUẬN CỦA GIÁM ĐỐC

### QUYẾT ĐỊNH: **REJECTED (CHƯA ĐỦ ĐIỀU KIỆN NGHIỆM THU)**

**Căn cứ ra quyết định:**
1. **Tồn tại lỗ hổng bảo mật tài chính mức CRITICAL:** `PaymentWebhookController` cho phép vượt qua xác thực HMAC khi không truyền chữ ký và tự động cấp hạn mức ví ảo khi khóa cọc.
2. **Mã nguồn Production API không biên dịch sạch & khóa các luồng lõi:** `application.service.ts` lỗi compile (`GeofenceUtils`), `identity.service.ts` lệch kiểu nullable `passwordHash`, `node_modules`/`package-lock.json` lệch, toàn bộ Escrow/VietQR trả `503`, thiếu API giao việc/chấm công/rút tiền/Admin.
3. **Thiếu kiểm chứng thực tế trên Production Stack:** Chỉ mới có 3 unit test `GeoUtils`; 0 test tích hợp PostgreSQL, 0 test tải, 0 test bảo mật; Expo `ActiveShiftScreen.tsx` vẫn chạy dữ liệu giả lập; `prisma/migrations` chưa chạy được trên CSDL trống.

**Yêu cầu trước khi trình nghiệm thu lại:** Hoàn thành toàn bộ **Giai đoạn 1 đến Giai đoạn 4** trong kế hoạch trên với đầy đủ bằng chứng test tự động xanh trên môi trường PostgreSQL + Redis thật.
