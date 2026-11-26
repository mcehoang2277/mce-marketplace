# Thiết lập tài khoản Admin dùng chung thông tin đăng nhập

MCE có hai runtime độc lập:
- Local PowerShell: server.ps1 + data/database.json, mặc định cổng 3000.
- Backend TypeScript: Prisma + PostgreSQL, API quản trị /api/admin/*.

Cả hai runtime chấp nhận cùng một bộ thông tin Admin (cùng số điện thoại và mật khẩu), nhưng mỗi runtime có bản ghi tài khoản và phiên đăng nhập riêng. Dữ liệu người dùng/escrow trong JSON không tự đồng bộ sang PostgreSQL.

## 1. Chạy bản local

Mở PowerShell tại thư mục dự án:

    Set-ExecutionPolicy -Scope Process Bypass
    .\start-local-admin.ps1

Nhập số điện thoại, tên hiển thị và mật khẩu Admin khi được hỏi. Mật khẩu tối thiểu 14 ký tự; script không ghi mật khẩu vào database.json, chỉ giữ biến môi trường trong tiến trình hiện tại.

Mở http://localhost:3000/admin. Phiên Admin local tồn tại tối đa 8 giờ và bị hủy khi dừng server.

## 2. Tạo cùng tài khoản trên backend PostgreSQL

Trong file .env của backend, đặt cùng thông tin:

    ADMIN_PHONE=so_dien_thoai_admin
    ADMIN_FULL_NAME=Ten_Admin
    ADMIN_PASSWORD=mat_khau_admin_tu_14_ky_tu
    ADMIN_BOOTSTRAP_CONFIRM=YES_I_UNDERSTAND

Không commit .env lên GitHub. Sau đó chạy:

    npm install
    npx prisma migrate deploy
    npm run db:seed:admin
    npm run build
    npm run dev

Mở http://localhost:8000/admin (hoặc cổng backend đã cấu hình). Seed yêu cầu ADMIN_BOOTSTRAP_CONFIRM=YES_I_UNDERSTAND. Nếu số điện thoại đã thuộc tài khoản không phải ADMIN, seed sẽ dừng thay vì tự nâng quyền khách hàng. Chỉ dùng số điện thoại quản trị chuyên dụng và xác minh đúng database trước khi chạy.

## Phạm vi hiện tại

- Local Admin: đăng nhập bằng mật khẩu cấu hình, token ngẫu nhiên hết hạn sau 8 giờ, xem tổng quan và danh sách người dùng.
- PostgreSQL Admin: dùng Prisma role ADMIN, JWT và kiểm tra quyền hiện tại trong database; giao diện có các API quản lý users/jobs/disputes/payments.
- Không tạo Admin bằng form đăng ký công khai.
- Local JSON và PostgreSQL vẫn là hai kho dữ liệu riêng; muốn đồng bộ dữ liệu nghiệp vụ cần xây API đồng bộ/migration riêng.
