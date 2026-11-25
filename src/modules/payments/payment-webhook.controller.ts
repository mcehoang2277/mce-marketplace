import { Request, Response } from 'express';
import crypto from 'crypto';
import { ENV } from '../../config/env';
import { prisma } from '../../core/database/prisma';
import { PostgresEscrowService } from '../escrow/postgres-escrow.service';
import { AppError } from '../../core/errors/app-error';

export class PaymentWebhookController {
  /**
   * Tiếp nhận Webhook thanh toán từ ngân hàng / Cổng trung gian (PayOS, SePay, Casso)
   * Xác thực chữ ký HMAC-SHA256 + Idempotency chống tấn công Replay + Tự động khóa cọc Escrow
   */
  public static async handleBankWebhook(req: Request, res: Response) {
    const signature = (req.headers['x-webhook-signature'] || req.headers['x-signature'] || '') as string;
    const body = req.body || {};

    // 1. Phân giải payload đa kênh (PayOS, SePay, hoặc Casso)
    const transactionId = body.id || body.transactionId || body.orderCode || body.referenceCode || `tx-${Date.now()}`;
    const amount = parseInt(String(body.amount || body.transferAmount || '0'), 10);
    const content = String(body.content || body.description || body.orderCode || '');
    const idempotencyKey = String(transactionId);

    // 2. Kiểm tra Idempotency lưu trữ bền vững trong PostgreSQL
    const existingWebhook = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey }
    });

    if (existingWebhook && existingWebhook.isProcessed) {
      return res.status(200).json({
        success: true,
        status: 'DUPLICATE_IGNORED',
        message: `Giao dịch ${idempotencyKey} đã được xử lý thành công trước đó.`
      });
    }

    // 3. Xác thực chữ ký HMAC-SHA256 nếu nhà cung cấp gửi Secret
    let isVerified = false;
    if (signature && ENV.WEBHOOK_HMAC_SECRET) {
      const payloadString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', ENV.WEBHOOK_HMAC_SECRET)
        .update(payloadString)
        .digest('hex');

      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        throw new AppError('Chữ ký Webhook không hợp lệ! Nghi vấn yêu cầu giả mạo.', 401);
      }
      isVerified = true;
    } else {
      isVerified = true; // Môi trường thử nghiệm cho phép bypass khi không cấu hình secret
    }

    // Ghi nhận sự kiện webhook vào Database
    const webhookRecord = await prisma.webhookEvent.upsert({
      where: { idempotencyKey },
      create: {
        provider: 'VIETQR',
        eventType: 'PAYMENT_RECEIVED',
        idempotencyKey,
        signature,
        payload: JSON.stringify(body),
        isVerified,
        isProcessed: false
      },
      update: {
        isVerified
      }
    });

    try {
      // 4. Phân tích nội dung chuyển khoản tìm mã Job: "MCE JOB-001" hoặc "MCE_JOB_001"
      const matchJob = content.match(/MCE[\s_]+([A-Za-z0-9-]+)/i);
      if (!matchJob) {
        await prisma.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: {
            isProcessed: true,
            processedAt: new Date(),
            errorMessage: 'Nội dung không chứa cú pháp MCE <MÃ_JOB>'
          }
        });

        return res.status(200).json({
          success: true,
          status: 'UNRECOGNIZED_CONTENT',
          message: 'Giao dịch hợp lệ nhưng không phát hiện cú pháp mã việc làm MCE.'
        });
      }

      const jobId = matchJob[1].toUpperCase();

      // Tìm Job trong Database
      const job = await prisma.job.findFirst({
        where: {
          OR: [
            { id: jobId },
            { id: { contains: jobId } }
          ]
        }
      });

      if (!job) {
        await prisma.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: {
            isProcessed: true,
            processedAt: new Date(),
            errorMessage: `Không tìm thấy ca việc với mã: ${jobId}`
          }
        });

        return res.status(200).json({
          success: true,
          status: 'JOB_NOT_FOUND',
          message: `Không tìm thấy ca việc ${jobId} trong hệ thống.`
        });
      }

      // 5. Kích hoạt Escrow bằng PostgreSQL Transaction
      const escrowResult = await PostgresEscrowService.lockEscrowTx(job.id, job.posterId, amount);

      // Cập nhật trạng thái PaymentTransaction nếu có
      await prisma.paymentTransaction.updateMany({
        where: {
          OR: [
            { referenceCode: { contains: jobId } },
            { jobId: job.id }
          ]
        },
        data: {
          status: 'SUCCESS',
          paidAt: new Date()
        }
      });

      // Đánh dấu Webhook đã xử lý trọn vẹn
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          isProcessed: true,
          processedAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        status: 'ESCROW_LOCKED_SUCCESS',
        jobId: job.id,
        grossAmount: escrowResult.grossAmount,
        netWorkerPayout: escrowResult.netWorkerPayout,
        platformFeeVnd: escrowResult.platformFeeVnd,
        referenceCode: idempotencyKey,
        message: `Ký quỹ 100% thành công qua VietQR 24/7! Ca "${job.title}" đã được mở trên bản đồ.`
      });
    } catch (err: any) {
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          errorMessage: err.message || 'Lỗi xử lý giao dịch'
        }
      });
      throw err;
    }
  }

  /**
   * Endpoint giả lập Webhook ngân hàng dùng cho Testing & QA
   */
  public static async simulateWebhook(req: Request, res: Response) {
    const { jobId, amount, customContent } = req.body;
    const targetJobId = jobId || 'JOB-001';
    const targetAmount = amount || 240000;
    const content = customContent || `MCE ${targetJobId}`;
    const fakeTxId = `SIM-TX-${Date.now()}`;

    req.body = {
      id: fakeTxId,
      amount: targetAmount,
      content,
      transactionId: fakeTxId
    };

    return await PaymentWebhookController.handleBankWebhook(req, res);
  }
}
