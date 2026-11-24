"""
MCE VIETQR HELPER MODULE
Hỗ trợ tạo mã VietQR động chuẩn NAPAS 247 để nạp tiền cọc ký quỹ (Escrow)
100% Thư viện chuẩn Python - Không phụ thuộc thư viện ngoài
"""

from typing import Dict
from urllib.parse import quote


class VietQRService:
    # Tài khoản ngân hàng mẫu của nền tảng MCE để giữ tiền Escrow
    DEFAULT_BANK_CODE = "MB"            # Ngân hàng Quân Đội (MB Bank)
    DEFAULT_ACCOUNT_NO = "0988888888"   # Số tài khoản chuyên thu ký quỹ MCE
    DEFAULT_ACCOUNT_NAME = "MCE VIETNAM ESCROW"

    @classmethod
    def generate_payment_info(
        cls,
        job_id: str,
        amount_vnd: int,
        bank_code: str = DEFAULT_BANK_CODE,
        account_no: str = DEFAULT_ACCOUNT_NO,
        account_name: str = DEFAULT_ACCOUNT_NAME
    ) -> Dict:
        """
        Tạo thông tin thanh toán chuyển khoản và link mã QR động
        sử dụng chuẩn liên ngân hàng VietQR.
        """
        # Nội dung chuyển khoản chuẩn hóa: MCE <MÃ CÔNG VIỆC>
        transfer_content = f"MCE {job_id.upper()}"
        
        # Link tạo ảnh VietQR tự động qua chuẩn API cộng đồng VietQR.io
        encoded_content = quote(transfer_content)
        encoded_name = quote(account_name)
        qr_image_url = (
            f"https://img.vietqr.io/image/{bank_code}-{account_no}-compact2.png"
            f"?amount={amount_vnd}&addInfo={encoded_content}&accountName={encoded_name}"
        )

        return {
            "bank_code": bank_code,
            "bank_name": "Ngân hàng Quân Đội (MBBank)",
            "account_number": account_no,
            "account_name": account_name,
            "amount_vnd": amount_vnd,
            "transfer_content": transfer_content,
            "qr_image_url": qr_image_url,
            "status": "WAITING_PAYMENT"
        }
