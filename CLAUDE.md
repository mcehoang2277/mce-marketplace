# CLAUDE.md — MCE On-Demand Time Marketplace

> **Mục tiêu dự án:** Sàn kết nối việc làm tức thời theo giờ tại Việt Nam (Hyperlocal Gig & On-demand Time Marketplace) với mô hình **0% phí sàn** cho người lao động.

---

## 1. Trạng Thái Hiện Tại & Định Hướng (Giai Đoạn 2)

* **Ưu tiên số 1:** Trải nghiệm khách hàng trên **Ứng Dụng Di Động (`mobile.html`)**. Tạm dừng bản Web Desktop (`index.html`).
* **Môi trường Live:** [https://mce-marketplace-z3dj.vercel.app/](https://mce-marketplace-z3dj.vercel.app/) (Tự động deploy từ nhánh `main`).
* **GitHub Repository:** [https://github.com/mcehoang2277/mce-marketplace](https://github.com/mcehoang2277/mce-marketplace)
* **Thư mục cục bộ:** `C:\Users\DELL\.gemini\antigravity\scratch\mce-marketplace`

---

## 2. Kiến Trúc & Các File Cốt Lõi

| File / Thư mục | Vai trò chính |
| :--- | :--- |
| **`mobile.html`** | **File quan trọng nhất (Single-File Mobile App):** Toàn bộ giao diện di động của Worker & Poster. Tích hợp bản đồ Leaflet GPS, radar quét việc tự động 6s, 13 ca việc thực tế, phân loại 7 nhóm ngành, chat nội bộ, cuộc gọi VoIP Web Audio, chụp ảnh nghiệm thu Watermark, rút tiền VietQR Napas 24/7, chấm điểm Karma. |
| **`auth.html`** | Màn hình đăng ký / đăng nhập độc lập: Xác minh số điện thoại không chặn OTP, mô phỏng eKYC quét CCCD gắn chip (Webcam/OCR), liên kết tài khoản ngân hàng. |
| **`vercel.json`** | Cấu hình triển khai tĩnh Vercel (`@vercel/static`): Định tuyến mọi đường dẫn `/`, `/mobile`, `/mobile.html` về `mobile.html` để tránh lỗi 500 Serverless Functions. |
| **`src/`** | Backend Modular Monolith (TypeScript + Express + Prisma): Gồm các module Auth, Geofence Matching, VietQR Escrow, Reputation (dành cho API server). |
| **`manifest.json` & `sw.js`** | Cấu hình PWA để người dùng có thể "Thêm vào màn hình chính" dùng như App Native trên iOS / Android. |

---

## 3. Quy Tắc & Lưu Ý Cho Claude Khi Phát Triển

1. **Mobile-First:** Mọi chức năng mới hoặc sửa lỗi UI đều phải tập trung vào `mobile.html`.
2. **Không loại bỏ ca làm ở xa:** Tại Việt Nam, các vùng ngoại thành và nông thôn (Thạch Thất, Sơn Tây, Mê Linh, Đông Anh, Thường Tín...) có khoảng cách từ 10km - 45km. Bộ lọc mặc định phải luôn là `🌏 Vùng Thưa Dân (Không Giới Hạn)` (`ALL`).
3. **Quy trình đăng ký thông suốt:** Không bao giờ tạo rào cản chặn người dùng bằng mã SMS OTP thật. Luôn có cơ chế tự điền OTP (`654321` / `123456`) và nút kích hoạt nhanh 1 chạm.
4. **Vercel Static Hosting:** Dự án frontend đang được Vercel serve dưới dạng static. Không thay đổi `vercel.json` sang serverless runtime trừ khi được yêu cầu.

---

## 4. Lệnh Hữu Ích

* **Kiểm tra trạng thái Git:** `git status`
* **Commit và đẩy lên Live Vercel:**
  ```bash
  git add .
  git commit -m "feat/fix: mô tả thay đổi"
  git push origin main
  ```
* **Kiểm tra phản hồi trang Live:**
  ```bash
  curl -I https://mce-marketplace-z3dj.vercel.app/
  ```
