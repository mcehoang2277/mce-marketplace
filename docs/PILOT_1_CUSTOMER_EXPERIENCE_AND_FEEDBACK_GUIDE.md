# KẾ HOẠCH TRIỂN KHAI BẢN THỬ NGHIỆM 1 (PILOT 1) — MCE MARKETPLACE
## HƯỚNG DẪN KHÁCH HÀNG TRẢI NGHIỆM TỪNG BƯỚC & THU THẬP Ý KIẾN THỰC TẾ

> **Phiên bản:** MCE Pilot Edition v2.8.0  
> **Link trải nghiệm trực tiếp:** [https://mce-marketplace-z3dj.vercel.app/mobile](https://mce-marketplace-z3dj.vercel.app/mobile)  
> **Thời gian thử nghiệm giai đoạn 1:** 14 ngày  
> **Quy mô mục tiêu:** 50 – 200 người dùng thử nghiệm thực tế (Chủ cửa hàng, kho bãi & người lao động)  

---

## 1. MỤC TIÊU CỐT LÕI CỦA BẢN THỬ NGHIỆM 1

1. **Khách hàng tự tay trải nghiệm các chức năng thực tế:**
   - Không xem slide, không dùng dữ liệu ảo — khách hàng trực tiếp thao tác trên điện thoại thật với tọa độ GPS thật.
2. **Kiểm chứng 5 đột phá sản phẩm:**
   - **Bản đồ trực tiếp:** Quét việc và quét thợ quanh bán kính 3.5km (đô thị lớn) đến 12km (tỉnh thành) không cần đọc danh sách dài dòng.
   - **Nhận việc 1 chạm:** Không cần viết hồ sơ xin việc (CV), không phỏng vấn rườm rà.
   - **Ký quỹ Napas/VietQR 2 chiều (Escrow):** Tiền công của thợ được chủ nạp giữ trước trong tài khoản trung gian, loại trừ 100% rủi ro bùng tiền.
   - **Gọi thoại VoIP miễn phí:** Đàm thoại trực tiếp qua mạng 4G/Wifi trong ứng dụng khi điện thoại hết tiền cước SIM.
   - **Nghiệm thu e-Proof:** Chụp ảnh hiện trường có đóng dấu tọa độ GPS và thời gian chính xác, giải ngân tiền công tức thì về tài khoản ngân hàng (0% phí sàn).
3. **Thu thập phản hồi thực tế (Real-world Feedback):**
   - Đánh giá mức độ phù hợp về giá công nhật, khoảng cách di chuyển tại từng thành phố và tính tiện lợi của giao diện.

---

## 2. KỊCH BẢN TRẢI NGHIỆM 5 BƯỚC CHO KHÁCH HÀNG

Khi gửi link `https://mce-marketplace-z3dj.vercel.app/mobile` cho khách hàng, hướng dẫn họ thực hiện theo 5 bước sau:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│              QUY TRÌNH TRẢI NGHIỆM 5 BƯỚC THỰC TẾ TRÊN MOBILE                   │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────┤
│  📍 BƯỚC 1      │  🤝 BƯỚC 2      │  📞 BƯỚC 3      │  📸 BƯỚC 4      │ 💸 BƯỚC 5│
│  Quét GPS       │  Nhận Việc &    │  Gọi VoIP Mạng  │  Chụp e-Proof   │ Rút Tiền│
│  Bản Đồ Thực    │  Ký Quỹ VietQR  │  Hết Tiền SIM   │  Nghiệm Thu     │ & Góp Ý │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────┘
```

### Bước 1: Quét Bản Đồ Radar Tìm Việc Xung Quanh (1 Phút)
- **Thao tác:** Bấm nút **"📍 Thử Quét Radar Bản Đồ Ngay"** (hoặc biểu tượng tâm ngắm GPS).
- **Trải nghiệm khách hàng:** 
  - Bản đồ tự động định vị vị trí hiện tại của người dùng.
  - Vòng radar màu xanh quét xung quanh bán kính 3.5km, hiển thị các ca việc đang cần người gấp (chấm đỏ) hoặc các bạn thợ đang rảnh (chấm xanh).
  - Có thể chuyển đổi qua lại giữa vai trò **"🛵 Làm"** hoặc **"🏢 Thuê"** chỉ bằng 1 chạm ở góc trên.

### Bước 2: Nhận Việc 1 Chạm & Xem Cơ Chế Ký Quỹ Escrow (2 Phút)
- **Thao tác:** Chạm vào một chấm việc trên bản đồ hoặc bấm **"Nhận Việc Ngay"**.
- **Trải nghiệm khách hàng:**
  - Hệ thống hiển thị rõ ràng: Tên công việc, địa chỉ làm việc, thời gian bắt đầu, tiền công (ví dụ: 280.000đ).
  - Điểm cốt lõi: Khách hàng thấy huy hiệu **"Ký quỹ Escrow: ĐÃ KHÓA TIỀN"** — tiền công đã được ngân hàng bảo lãnh, yên tâm 100% đến làm mà không sợ bị quỵt tiền.

### Bước 3: Đàm Thoại VoIP Trực Tiếp Qua 4G Khi Hết Tiền SIM (1 Phút)
- **Thao tác:** Bấm biểu tượng **"📞 Gọi Thoại Miễn Phí"**.
- **Trải nghiệm khách hàng:**
  - Màn hình cuộc gọi thoại bật lên với hiệu ứng sóng âm thanh (Soundwave).
  - Kết nối đàm thoại trực tiếp qua đường truyền mạng 4G/Wifi, giải quyết triệt để nỗi lo *"điện thoại hết tiền cước không gọi được cho chủ/thợ"*.

### Bước 4: Chụp Ảnh e-Proof Nghiệm Thu Công Việc (2 Phút)
- **Thao tác:** Khi hết giờ làm, bấm nút **"📸 Chụp Ảnh Nghiệm Thu"**.
- **Trải nghiệm khách hàng:**
  - Máy ảnh (Camera) của điện thoại được kích hoạt.
  - Chụp ảnh công việc đã làm (ví dụ: kiện hàng đã gói xong, quán đã dọn sạch).
  - Hệ thống tự động đóng dấu chìm: **Tọa độ GPS thực tế + Dấu mốc thời gian** chống gian lận.

### Bước 5: Giải Ngân Về Ví & Rút Tiền VietQR 24/7 (1 Phút)
- **Thao tác:** Chuyển sang tab **"Ví Tiền"** -> Bấm **"💸 Rút Tiền Về Ngân Hàng"**.
- **Trải nghiệm khách hàng:**
  - Tiền công giải ngân trọn vẹn 100% vào ví (ưu đãi 0% phí sàn trong 90 ngày đầu).
  - Nhập số tài khoản ngân hàng bất kỳ tại Việt Nam và bấm xác nhận rút tiền qua Napas 24/7.

---

## 3. CƠ CHẾ THU THẬP Ý KIẾN ĐÓNG GÓP THỰC TẾ (FEEDBACK ENGINE)

Ứng dụng đã tích hợp sẵn nút nổi: **`💬 Góp Ý Thực Tế`** ở góc dưới màn hình.

### Các Trường Dữ Liệu Thu Thập:
1. **Vai trò người dùng:** Chủ quán/cơ sở thuê việc HOẶC Người lao động/Thợ tự do.
2. **Khu vực sinh sống:** Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng, Cần Thơ, Tỉnh thành khác.
3. **Đánh giá mức độ hài lòng:** Từ 1 đến 5 sao vàng.
4. **Tính năng khách hàng ưng ý nhất:**
   - [x] Bản đồ quét việc tức thời quanh GPS
   - [x] Nhận việc 1 chạm không cần CV hay phỏng vấn
   - [x] Gọi thoại VoIP miễn phí khi hết tiền SIM
   - [x] Tiền công được ký quỹ bảo đảm 100% an toàn
   - [x] Chụp ảnh nghiệm thu e-Proof có dấu tọa độ GPS
5. **Góp ý thực tế chi tiết:** Khách hàng chia sẻ ý kiến về mức giá công việc tại địa phương, cự ly đi lại, thời gian nhận việc và tính năng muốn bổ sung.
6. **Số điện thoại / Zalo nhận tri ân:** Tặng mã voucher ưu đãi **`MCE-PILOT-50K`** trị giá 50.000đ khi ứng dụng phát hành chính thức.

---

## 4. KẾ HOẠCH TRIỂN KHAI THỰC CHIẾN TẠI TỪNG ĐÔ THỊ VIỆT NAM

| Nhóm Đô Thị | Đối Tượng Mục Tiêu | Nhu Cầu Ca Việc Thực Tế | Mức Giá Thử Nghiệm Phù Hợp |
|---|---|---|---|
| **Hà Nội & TP.HCM** (Đô thị mật độ cao) | Sinh viên, shipper rảnh giờ, chủ shop online, quán ăn, quán cà phê | Ca ngắn 2 - 4 tiếng: Đóng gói hàng, phụ bưng bê, trực ca đột xuất, xếp hàng | 35.000đ – 50.000đ / giờ |
| **Đà Nẵng, Cần Thơ, Hải Phòng** (Đô thị loại 1) | Lao động phổ thông, thợ điện nước, giúp việc nhà, cơ sở dịch vụ | Ca nửa ngày hoặc theo việc: Phụ dọn dẹp, bốc dỡ hàng chợ đầu mối, giao hàng | 40.000đ – 60.000đ / giờ |
| **Các Tỉnh Thành Khác** (Mật độ thấp, bán kính rộng 10-15km) | Lao động nông nhàn, thợ lành nghề, trang trại | Ca cả ngày hoặc theo khối lượng: Phụ hồ, thu hái nông sản, kiểm kho | 250.000đ – 350.000đ / ngày |

---

## 5. CÁCH THEO DÕI VÀ XUẤT BÁO CÁO DỮ LIỆU ĐÓNG GÓP

- Toàn bộ ý kiến đóng góp của khách hàng được lưu trữ trực tiếp vào bộ nhớ an toàn (`localStorage: mce_pilot_feedbacks`).
- Người quản trị có thể xem danh sách góp ý trực tiếp trên ứng dụng ngay trong mục **"Các ý kiến đã đóng góp gần đây"** hoặc bấm xem sổ nhật ký.
- Định kỳ 3 ngày, đội ngũ kỹ thuật sẽ tổng hợp dữ liệu để tinh chỉnh sản phẩm trước khi nộp lên CH Play và App Store.
