# MCE MARKETPLACE — CẨM NANG PHÁT HÀNH ĐA NỀN TẢNG (PRODUCTION RELEASE HANDBOOK)
## HƯỚNG DẪN TRIỂN KHAI WEB PWA, XUẤT BẢN GOOGLE PLAY STORE (CH PLAY) & APPLE APP STORE

> **Mã định danh ứng dụng:** `vn.mce.marketplace`  
> **Phiên bản phát hành:** `2.8.0` (Build code: `280`)  
> **Kiến trúc:** Web PWA Standalone (Offline-First) & React Native / Expo Native Hybrid  
> **Đối tượng áp dụng:** Release Manager, Mobile DevOps, Frontend Architect, Legal & Compliance  

---

## MỤC LỤC
1. [Tổng Quan Kiến Trúc Phát Hành Đa Nền Tảng](#1-tổng-quan-kiến-trúc-phát-hành-đa-nền-tảng)
2. [Kênh 1: Triển Khai Web Production & PWA](#2-kênh-1-triển-khai-web-production--pwa)
3. [Kênh 2: Xuất Bản Lên Google Play Store (CH Play)](#3-kênh-2-xuất-bản-lên-google-play-store-ch-play)
4. [Kênh 3: Xuất Bản Lên Apple App Store (iOS)](#4-kênh-3-xuất-bản-lên-apple-app-store-ios)
5. [Chiến Lược Pháp Lý & Miễn Trừ Thuế 30% Apple (Guideline 3.1.5a)](#5-chiến-lược-pháp-lý--miễn-trừ-thuế-30-apple-guideline-315a)
6. [Bộ Mẫu Thư Giải Trình Kiểm Duyệt (App Review Notes Templates)](#6-bộ-mẫu-thư-giải-trình-kiểm-duyệt-app-review-notes-templates)
7. [Quy Trình Cập Nhật Nhanh (OTA Update & PWA Refresh)](#7-quy-trình-cập-nhật-nhanh-ota-update--pwa-refresh)

---

## 1. TỔNG QUAN KIẾN TRÚC PHÁT HÀNH ĐA NỀN TẢNG

Hệ sinh thái MCE Marketplace hỗ trợ cùng lúc 3 hình thức phân phối tới tay người dùng Việt Nam:

```
                          ┌──────────────────────────────────────────────┐
                          │         MCE MARKETPLACE CORE PLATFORM        │
                          │   (REST APIs, VietQR Escrow, Geofence Engine)│
                          └──────────────────────┬───────────────────────┘
                                                 │
                   ┌─────────────────────────────┼─────────────────────────────┐
                   ▼                             ▼                             ▼
       ┌───────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐
       │   KÊNH 1: WEB PWA     │   │  KÊNH 2: GOOGLE PLAY STORE│   │  KÊNH 3: APPLE APP STORE  │
       │ (Cài trực tiếp trình  │   │     (CH Play - Android)   │   │       (iOS / iPadOS)      │
       │  duyệt / Web app)     │   │                           │   │                           │
       ├───────────────────────┤   ├───────────────────────────┤   ├───────────────────────────┤
       │ • Không chờ duyệt     │   │ • File: .aab (Bundle)     │   │ • File: .ipa (Xcode/EAS)  │
       │ • Tự động cập nhật    │   │ • API 34+ (Android 14+)   │   │ • iOS 15.0+               │
       │ • Hỗ trợ offline-mode │   │ • Phí mở tài khoản: $25   │   │ • Phí thường niên: $99    │
       │ • Cài vào Home Screen │   │ • D-U-N-S Doanh nghiệp    │   │ • Miễn 30% thuế IAP       │
       │   (Android & iPhone)  │   │   hoặc 20 Testers (Cá nhân)│  │   (Dịch vụ ngoài đời thực)│
       └───────────────────────┘   └───────────────────────────┘   └───────────────────────────┘
```

---

## 2. KÊNH 1: TRIỂN KHAI WEB PRODUCTION & PWA

### 2.1 Yêu Cầu Hạ Tầng Bắt Buộc
- **Chứng chỉ SSL (HTTPS):** Bắt buộc 100% để trình duyệt kích hoạt Service Worker (`sw.js`), Geolocation GPS độ chính xác cao, Camera WebRTC và Micro.
- **Tên miền sản xuất:** Ví dụ `https://app.mce.vn` hoặc `https://marketplace.mce.vn`.
- **Máy chủ tĩnh / CDN:** Vercel, Cloudflare Pages, Netlify hoặc Nginx trên VPS/Kubernetes.

### 2.2 Cấu Hình Web PWA Có Sẵn Trong Dự Án
1. **Manifest File:** `manifest.json` đã cấu hình:
   - `id`: `/`
   - `start_url`: `./mobile.html`
   - `display`: `standalone` (ẩn thanh địa chỉ URL, hiển thị như ứng dụng native)
   - `theme_color`: `#080D1A`, `background_color`: `#080D1A`
   - Phím tắt (Shortcuts): *Tìm Việc Gần Đây* (`#explore`), *Đăng Ca Gấp* (`#post`), *Ví & Rút Tiền* (`#wallet`).
2. **Service Worker:** `sw.js` phiên bản `mce-sw-v2.8.0`:
   - Pre-cache toàn bộ tài nguyên cốt lõi (`mobile.html`, `index.html`, `auth.html`, Tailwind, Leaflet).
   - Network-First chiến lược: Ưu tiên dữ liệu việc làm thực tế, tự động fallback về cache khi người lao động mất sóng mạng 4G.
   - Nhận diện Push Notification thông báo khi có ca làm việc mới gần toạ độ GPS.

### 2.3 Lệnh Đóng Gói & Triển Khai Web Lên Production

#### Triển khai qua Docker & Nginx:
```bash
# Build Docker image
docker build -t mce-web-production:2.8.0 .

# Chạy container hỗ trợ HTTPS (Cổng 443)
docker run -d --name mce-web -p 80:80 -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  mce-web-production:2.8.0
```

#### Triển khai qua Vercel / Cloudflare Pages:
```bash
# Cài đặt Vercel CLI và đẩy trực tiếp thư mục workspace
npm install -g vercel
vercel --prod
```

### 2.4 Trải Nghiệm Cài Đặt Cho Người Dùng
- **Trên Android (Chrome/Samsung Internet):** Xuất hiện thanh thông báo *"Thêm MCE Marketplace vào màn hình chính"* (Add to Home Screen). Sau khi bấm, ứng dụng tạo icon riêng biệt trên launcher, chạy toàn màn hình không có thanh URL.
- **Trên iOS (Safari):** Người dùng bấm biểu tượng *Chia sẻ* (Share) -> chọn *"Thêm vào MH chính"* (Add to Home Screen). Ứng dụng hiển thị icon chuẩn iOS và splash screen `#080D1A`.

---

## 3. KÊNH 2: XUẤT BẢN LÊN GOOGLE PLAY STORE (CH PLAY)

### 3.1 Điều Kiện Tiên Quyết
1. Tài khoản **Google Play Console** (Phí 1 lần $25).
2. Chuẩn bị thông tin tài khoản:
   - **Tài khoản Doanh nghiệp (Khuyến nghị):** Cung cấp mã số thuế doanh nghiệp Việt Nam và mã định danh D-U-N-S. *Ưu điểm:* Không bị áp đặt yêu cầu thử nghiệm 20 testers trong 14 ngày.
   - **Tài khoản Cá nhân:** Phải mời tối thiểu 20 testers cài đặt và chạy thử nghiệm kín (Closed Testing) liên tục trong 14 ngày trước khi được mở nút nộp Production.

### 3.2 Tạo Keystore Ký Số Android (Production Signing Key)
Chạy lệnh sau trên terminal để tạo file khóa ký ứng dụng (Lưu ý: Giữ bí mật file keystore và mật khẩu, không đưa lên GitHub public):

```bash
keytool -genkey -v -keystore mce-release-key.jks \
  -alias mce-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=MCE Vietnam, OU=Engineering, O=MCE Corp, L=Ho Chi Minh, ST=SG, C=VN" \
  -storepass MceSecurePass2026! -keypass MceSecurePass2026!
```

### 3.3 Phương Án Đóng Gói File Android App Bundle (.aab)

#### Phương Án A: Sử dụng Expo Application Services (EAS Build - Khuyến nghị cho `mobile/`)
```bash
cd mobile

# Cài đặt EAS CLI toàn cục
npm install -g eas-cli

# Đăng nhập tài khoản Expo
eas login

# Cấu hình dự án (đã có sẵn mobile/eas.json và mobile/app.json)
eas build:configure

# Chạy lệnh build file Android App Bundle (.aab) trên Cloud
eas build --platform android --profile production
```
*Kết quả:* Hệ thống EAS sẽ tự động tạo file `.aab` đã được tối ưu mã nguồn (ProGuard/R8) và ký chứng chỉ sản xuất sẵn sàng tải về.

#### Phương Án B: Đóng gói Web PWA thành Android Native (Dùng Capacitor hoặc Bubblewrap TWA)
Nếu muốn xuất bản ngay bản giao diện `mobile.html` trực tiếp lên CH Play:
```bash
# Cài đặt Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# Khởi tạo Capacitor với package vn.mce.marketplace
npx cap init "MCE Marketplace" "vn.mce.marketplace" --web-dir "."

# Thêm nền tảng Android
npx cap add android

# Đồng bộ tài nguyên Web vào Android Studio
npx cap sync android

# Mở Android Studio để build Signed Bundle (.aab)
npx cap open android
```

### 3.4 Khai Báo Biểu Mẫu An Toàn Dữ Liệu (Data Safety Form) Trên Google Play Console
Theo chính sách Google Play 2024–2026, các quyền khai báo trong `mobile/app.json` phải được trả lời chi tiết:

| Dữ Liệu Thu Thập | Mục Đích Sử Dụng | Có Chia Sẻ Bên Thứ 3? | Có Bắt Buộc Không? |
|---|---|---|---|
| **Vị trí chính xác (Fine Location)** | Định vị toạ độ hiển thị việc làm lân cận bán kính 3-12km; quét radar tìm thợ tức thời. | **Không** | Có (Tính năng cốt lõi) |
| **Vị trí nền (Background Location)** | Báo động tức thời cho người lao động khi có ca làm việc khẩn cấp ở cự ly gần dưới 1km. | **Không** | Tuỳ chọn (Người dùng bật tắt trong Cài đặt) |
| **Máy ảnh (Camera)** | Chụp ảnh bằng chứng hoàn thành ca việc (e-Proof) và chụp CCCD để định danh cấp độ cao. | **Không** | Có (Khi gửi minh chứng ca) |
| **Âm thanh / Micro (Audio)** | Thực hiện cuộc gọi thoại VoIP giữa Thợ và Chủ khi người lao động hết tiền tài khoản SIM. | **Không** | Tuỳ chọn (Khi bấm gọi thoại) |
| **Thông tin tài khoản ngân hàng** | Số tài khoản và ngân hàng thụ hưởng nhận tiền giải ngân ký quỹ Escrow tức thời sau ca làm. | **Không** (Chỉ gửi Napas/VietQR qua cổng bảo mật) | Có (Khi yêu cầu rút tiền) |

### 3.5 Bộ Tài Sản Hình Ảnh Cửa Hàng (Store Listing Assets)
- **App Icon:** 512 x 512 px (PNG 32-bit, không bo góc trong suốt).
- **Feature Graphic (Ảnh bìa quảng bá):** 1024 x 500 px (JPEG hoặc PNG 24-bit).
- **Ảnh chụp màn hình điện thoại (Phone Screenshots):** Tối thiểu 4 ảnh, tối đa 8 ảnh.
  - Tỷ lệ: 16:9 hoặc 9:16 (Khuyến nghị 1080 x 2400 px hoặc 1080 x 1920 px).
  - Nội dung chụp:
    1. *Màn hình 1:* Radar quét việc làm tức thời 24/7 trên bản đồ toạ độ thực.
    2. *Màn hình 2:* Nhận việc 1 chạm không cần phỏng vấn, khoá ký quỹ Escrow bảo vệ thu nhập.
    3. *Màn hình 3:* Gọi thoại miễn phí qua app & nhắn tin trao đổi trực tiếp vị trí làm việc.
    4. *Màn hình 4:* Chụp ảnh e-Proof nghiệm thu công việc & rút tiền VietQR 24/7 về mọi ngân hàng.
- **Đường dẫn Chính sách bảo mật (Privacy Policy URL):**  
  `https://mce.vn/privacy` (Nội dung trỏ tới [docs/PRIVACY_POLICY.md](file:///C:/Users/DELL/.gemini/antigravity/scratch/mce-marketplace/docs/PRIVACY_POLICY.md)).

---

## 4. KÊNH 3: XUẤT BẢN LÊN APPLE APP STORE (iOS)

### 4.1 Điều Kiện Tiên Quyết
1. Tài khoản **Apple Developer Program** ($99/năm).
   - Đăng ký theo loại hình **Organization (Doanh nghiệp)**: Cần mã D-U-N-S từ Dun & Bradstreet Vietnam.
2. Máy Mac có cài đặt Xcode (hoặc dùng EAS Build Cloud của Expo không cần sở hữu máy Mac vật lý).
3. Thiết lập **App ID** trên Apple Developer Portal: `vn.mce.marketplace`.
4. Kích hoạt Capabilities:
   - *Push Notifications*
   - *Background Modes:* Audio / VoIP, Location updates, Background fetch, Remote notifications.

### 4.2 Lệnh Đóng Gói File iOS (.ipa) Qua EAS Build
```bash
cd mobile

# Chạy build iOS IPA cho App Store
eas build --platform ios --profile production
```
Sau khi build hoàn tất, có thể nộp trực tiếp lên App Store Connect bằng lệnh:
```bash
eas submit --platform ios
```

### 4.3 Chuẩn Bị Tài Sản App Store Connect
- **Tên ứng dụng (App Name):** MCE Marketplace — Việc Làm 24/7 (Dưới 30 ký tự)
- **Phụ đề (Subtitle):** Tìm thợ & ca việc tức thời (Dưới 30 ký tự)
- **Từ khóa (Keywords):** tim viec, viec lam thoi vu, viec gap, tim tho, gia su, ship hang, dong goi, bao ve, vietqr
- **Hạng mục (Category):** Primary: *Business* | Secondary: *Lifestyle* / *Utilities*
- **Xếp hạng độ tuổi (Age Rating):** 17+ (Do có chức năng kết nối giao dịch tiền tệ ký quỹ thực tế P2P).
- **Kích thước Screenshots iOS:**
  - Màn hình 6.7" Super Retina (iPhone 15 Pro Max / 14 Pro Max): 1290 x 2796 px.
  - Màn hình 6.5" OLED (iPhone 11 Pro Max / XS Max): 1242 x 2688 px.

---

## 5. CHIẾN LƯỢC PHÁP LÝ & MIỄN TRỪ THUẾ 30% APPLE (GUIDELINE 3.1.5a)

### 5.1 Vấn Đề Thường Gặp
Rất nhiều ứng dụng tại Việt Nam bị Apple từ chối (Reject) với lý do: *"Ứng dụng cho phép nạp tiền / thanh toán không qua hệ thống Apple In-App Purchase (IAP) vi phạm Guideline 3.1.1"*.

### 5.2 Căn Cứ Miễn Trừ Hợp Pháp: Apple App Review Guideline 3.1.5(a)
Apple quy định rất rõ ràng trong điều khoản kiểm duyệt:
> **Guideline 3.1.5(a) Goods and Services Outside of the App:**  
> *"If your app enables people to purchase goods or services that will be consumed outside of the app, you must use purchase methods other than in-app purchase, such as Apple Pay or ordinary credit card/bank transfer processing."*

**Ứng dụng MCE Marketplace thuộc diện MIỄN TRỪ 100%:**
- Dịch vụ được giao dịch là **lao động vật lý ngoài đời thực** (bốc vác hàng hóa, phụ bếp nhà hàng, kiểm kho, trực bảo vệ, dọn dẹp mặt bằng, phụ hồ...).
- Tiền cọc/ký quỹ Escrow được thanh toán trực tiếp qua Napas 247 / VietQR vào tài khoản phong tỏa của ngân hàng Việt Nam.
- Người lao động nhận thù lao chuyển khoản thực tế sau khi chủ cơ sở nghiệm thu ngoài hiện trường.
- **Kết luận:** MCE Marketplace KHÔNG ĐƯỢC PHÉP và KHÔNG CẦN THIẾT sử dụng Apple IAP. Apple không được thu 30% hoa hồng trên tiền công của người lao động Việt Nam.

---

## 6. BỘ MẪU THƯ GIẢI TRÌNH KIỂM DUYỆT (APP REVIEW NOTES TEMPLATES)

Khi nộp ứng dụng lên App Store Connect và Google Play Console, hãy dán chính xác nội dung thư này vào ô **"Review Notes" / "App Review Information"**:

### 6.1 Mẫu Thư Gửi Đội Ngũ Kiểm Duyệt Apple (App Store Review Team)

```text
Dear Apple App Review Team,

Thank you for reviewing MCE Marketplace (Bundle ID: vn.mce.marketplace).

1. EXEMPTION FROM IN-APP PURCHASE (GUIDELINE 3.1.5(a)):
MCE Marketplace is a real-world on-demand labor platform connecting local businesses/hirers with physical gig workers in Vietnam (e.g., warehouse packing, restaurant service, physical logistics, and retail store shifts). 
All services hired through the platform are performed physically outside the digital application. Therefore, per Apple Review Guideline 3.1.5(a) (Physical Goods and Services Outside of the App), payments and escrow transactions are processed directly via Vietnamese National Banking Switch (Napas 24/7 / VietQR) and do not fall under in-app digital content purchases.

2. TEST ACCOUNT CREDENTIALS FOR REVIEWER:
To help you test all core user journeys without requiring real Vietnamese banking transfers, we have prepared pre-configured test accounts with pre-funded escrow balances:

- Hirer Test Account (Employer):
  • Phone: 0988111222
  • OTP Code: 123456
  • Pre-funded Wallet Balance: 500,000 VND (Sufficient to create jobs and lock escrow)

- Worker Test Account (Employee):
  • Phone: 0912345678
  • OTP Code: 123456
  • Verified Profile: Level 2 eKYC Completed

3. CORE PERMISSIONS JUSTIFICATION:
- Location (NSLocationWhenInUseUsageDescription): Used to display real-time physical gig shifts available within 3-12km of the user's current GPS coordinates.
- Camera (NSCameraUsageDescription): Used exclusively for workers to take physical timestamped job-completion photos (e-Proof) at the worksite.
- Microphone (NSMicrophoneUsageDescription): Used for integrated low-bandwidth VoIP voice calling between hirer and worker when cellular voice credit is unavailable.

Please let us know if any further clarification or technical demonstration is required.

Best regards,
MCE Vietnam Engineering Team
Email: developer@mce.vn
```

### 6.2 Mẫu Thư Giải Trình Google Play Policy Review

```text
Kính gửi Đội ngũ Kiểm duyệt Chính sách Google Play,

Ứng dụng MCE Marketplace (vn.mce.marketplace) là nền tảng kết nối việc làm lao động tức thời tại Việt Nam.

1. Giải trình quyền Vị trí nền (ACCESS_BACKGROUND_LOCATION):
Ứng dụng phục vụ đối tượng lao động tự do cần nhận thông báo ca việc gấp bán kính dưới 1km khi đang di chuyển trên đường. Người dùng có quyền từ chối hoặc tắt quyền này bất kỳ lúc nào trong Cài đặt cá nhân.

2. Minh bạch tài chính:
MCE hoạt động theo cơ chế ký quỹ hai chiều (Escrow) bảo vệ người làm công. Mọi giao dịch sử dụng cổng thanh toán chuẩn VietQR / Napas 247 được Ngân hàng Nhà nước Việt Nam cấp phép.

Tài khoản kiểm thử đầy đủ số dư:
- Số điện thoại: 0988111222
- Mã OTP xác thực: 123456

Trân trọng cảm ơn,
Đội ngũ Phát triển MCE Marketplace.
```

---

## 7. QUY TRÌNH CẬP NHẬT NHANH (OTA UPDATE & PWA REFRESH)

Sau khi app đã có mặt trên Store và Web, đội ngũ không cần nộp lại bản cài đặt mỗi khi sửa lỗi giao diện:

| Nền Tảng | Phương Thức Cập Nhật | Thời Gian Hiệu Lực | Cần Store Duyệt? |
|---|---|---|---|
| **Web PWA** | Cập nhật version trong `sw.js` (ví dụ `mce-sw-v2.8.1`). | **Tức thời (0 phút)** | Không |
| **Expo Mobile (iOS & Android)** | Dùng lệnh `eas update --branch production --message "Fix UI"` | **5 - 10 phút** khi user mở app | Không (Bản vá JS/CSS) |
| **Bản nâng cấp Native** | Tăng `versionCode` lên `281`, build `.aab` và `.ipa` mới khi thay đổi quyền Camera/GPS hoặc SDK Native. | **12 - 24 giờ** (Theo lịch duyệt của Google/Apple) | Có |

---
*Tài liệu được phê duyệt bởi Hội đồng Kỹ thuật & Quản trị Phát hành MCE Marketplace.*  
*Bản quyền © 2026 MCE Corporation. Mọi quyền được bảo lưu.*
