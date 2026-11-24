import { Request, Response } from 'express';
import crypto from 'crypto';
import { ENV } from '../../config/env';
import { ProductionEscrowService } from '../escrow/escrow.service';
import { AppError } from '../../core/errors/app-error';

export class PaymentWebhookController {
  // Bộ lưu trữ Idempotency Key có giới hạn kích thước (Bounded LRU Cache max 10.000 mục) triệt tiêu 100% rò rỉ RAM (Memory Leak)
  private static readonly MAX_CACHE_SIZE = 10000;
  private static processedReferenceCodes: Set<string> = new Set();

  private static recordProcessed(ref: string) {
    if (this.processedReferenceCodes.size >= this.MAX_CACHE_SIZE) {
      const oldest = this.processedReferenceCodes.values().next().value;
      if (oldest) this.processedReferenceCodes.delete(oldest);
    }
    this.processedReferenceCodes.add(ref);
  }

  /**
   * Tiếp nhận Webhook thanh toán từ ngân hàng (Casso / SePay / PayOS)
   */
  public static handleBankWebhook(req: Request, res: Response) {
    const signature = req.headers['x-webhook-signature'] as string;
    const { referenceCode, content, amount, transactionId } = req.body;

    const ref = referenceCode || transactionId || `tx-${Date.now()}`;

    // 1. Kiểm tra lặp giao dịch (Idempotency Check)
    if (PaymentWebhookController.processedReferenceCodes.has(ref)) {
      return res.status(200).json({
        success: true,
        status: 'DUPLICATE_IGNORED',
        message: `Giao dịch ${ref} đã được xử lý trước đó.`
      });
    }

    // 2. Xác thực chữ ký HMAC SHA-256 (nếu client gửi kèm secret)
    if (signature) {
      const payloadString = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', ENV.WEBHOOK_HMAC_SECRET)
        .update(payloadString)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new AppError('Chữ ký Webhook không khớp. Nghi vấn yêu cầu giả mạo!', 401);
      }
    }

    // 3. Phân tích nội dung chuyển khoản tìm mã Job: "MCE JOB-HANOI-001"
    const contentText = String(content || '');
    const match = contentText.match(/MCE\s+([A-Za-z0-9-_]+)/i);

    if (!match) {
      return res.status(200).json({
        success: true,
        status: 'UNRECOGNIZED_CONTENT',
        message: 'Nội dung chuyển khoản không chứa cú pháp MCE <MÃ_JOB>'
      });
    }

    const jobId = match[1].toUpperCase();
    const paidAmount = parseInt(String(amount || '0'), 10);

    // 4. Khóa cọc Escrow tự động
    // Giả sử 3 tiếng và đơn giá suy ra từ tổng tiền
    const escrowRecord = ProductionEscrowService.lockEscrow(jobId, 'POSTER-WEBHOOK', 3, Math.round(paidAmount / 3));

    // Đánh dấu giao dịch đã hoàn tất (Có tự động dọn dẹp LRU)
    PaymentWebhookController.recordProcessed(ref);

    return res.status(200).json({
      success: true,
      status: 'ESCROW_LOCKED_SUCCESS',
      jobId,
      grossVnd: escrowRecord.grossAmountVnd.toString(),
      platformFeeVnd: escrowRecord.platformFeeVnd.toString(),
      workerPayoutVnd: escrowRecord.netWorkerPayoutVnd.toString(),
      referenceCode: ref
    });
  }
}
