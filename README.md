# MCE Marketplace

MCE Marketplace là nền tảng kết nối người thuê và người làm theo ca/ngắn hạn. Backend sử dụng TypeScript, Express, Prisma và PostgreSQL; ứng dụng di động sử dụng Expo / React Native.

## Trạng thái phát hành

**Chưa được phê duyệt chạy production hoặc xử lý tiền thật.** Repository đang trong giai đoạn hardening và tích hợp. Không sử dụng dữ liệu demo để đại diện số dư, giao dịch, OTP, eKYC hoặc trạng thái thanh toán thật.

Các nguyên tắc sản phẩm đã chốt:

- Phí nền tảng: **0%**.
- Khách hàng: Web/PWA và ứng dụng Expo.
- Backend: TypeScript, PostgreSQL, triển khai managed.
- Thanh toán và giải ngân thật chỉ được bật sau khi hoàn thành kiểm thử sandbox, đối soát, bảo mật và phê duyệt vận hành.

## Thành phần chính

- `src/`: Express API, xác thực, công việc, thanh toán và nghiệp vụ.
- `prisma/`: Prisma schema và database migrations.
- `mobile/`: ứng dụng Expo.
- `tests/`: kiểm thử backend.
- `Dockerfile`, `docker-compose.yml`: môi trường container cục bộ.

Các máy chủ demo cũ và dữ liệu JSON mẫu đã được gỡ khỏi nhánh chính. Không khôi phục chúng để chạy sản phẩm.

## Yêu cầu

- Node.js 20 LTS.
- PostgreSQL 16.
- npm.
- Expo CLI được gọi qua `npx`.

## Chạy backend cục bộ

1. Tạo database PostgreSQL rỗng tên `mce_marketplace`.
2. Sao chép `.env.example` thành `.env`.
3. Điền `DATABASE_URL` trỏ đến PostgreSQL cục bộ và `JWT_SECRET` ngẫu nhiên tối thiểu 32 ký tự.
4. Cài dependencies và áp dụng migrations:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

API mặc định chạy tại `http://localhost:8000`; health check tại `http://localhost:8000/api/health`.

## Chạy ứng dụng Expo

```bash
cd mobile
npm install
npx expo start
```

Cấu hình API base URL trong ứng dụng phải trỏ đến backend có thể truy cập từ thiết bị. Không dùng `localhost` trên điện thoại thật để thay cho địa chỉ máy chạy backend.

## Kiểm thử

```bash
npm test
npm run typecheck
cd mobile
npx tsc --noEmit
```

Các lệnh kiểm thử phải chạy thành công trên môi trường CI có PostgreSQL trước khi phát hành. Kết quả build frontend tĩnh không thay thế kiểm thử backend, migration, webhook hoặc giao dịch đồng thời.

## Biến môi trường quan trọng

Xem `.env.example`. Không commit `.env`, secret, dữ liệu người dùng hoặc bản sao database. Docker Compose yêu cầu credentials được cấp qua biến môi trường; PostgreSQL chỉ bind vào loopback trên máy chủ.

## Các cổng kiểm soát trước khi ra mắt

- Hoàn tất và kiểm thử Ledger/đối soát số dư, SUSPENSE và maker-checker.
- Xác nhận hợp đồng chữ ký webhook với nhà cung cấp trong sandbox.
- Hoàn tất luồng đăng ký/đăng nhập, OTP SMS thật và xác minh danh tính; không dùng OTP giả.
- Kiểm thử toàn bộ luồng đăng việc → thanh toán → nhận việc → GPS check-in/out → nghiệm thu → ví.
- Hoàn thiện quản trị, xử lý tranh chấp, rút tiền và đối soát nhà cung cấp.
- Kiểm thử bảo mật, tải, backup/restore, monitoring và quy trình ứng cứu.
- Hoàn tất rà soát pháp lý/kế toán về giữ hộ và giải ngân tiền.
- Chỉ bật production sau khi có phê duyệt riêng cho hạ tầng, secrets và nhà cung cấp thanh toán.

