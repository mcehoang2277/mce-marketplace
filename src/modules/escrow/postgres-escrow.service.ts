import { randomUUID } from 'crypto';
import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/app-error';
import { LedgerAccountType, LedgerEntrySide, Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';

export interface EscrowTxResult {
  jobId: string;
  posterId: string;
  workerId?: string | null;
  grossAmount: number;
  platformFeeVnd: number;
  netWorkerPayout: number;
  status: string;
  lockedAt?: Date | null;
  releasedAt?: Date | null;
  refundedAt?: Date | null;
}

async function lockJobRow(tx: Prisma.TransactionClient, jobId: string) {
  await tx.$queryRawUnsafe('SELECT "id" FROM "Job" WHERE "id" = $1 FOR UPDATE', jobId);
}

async function lockWalletsByUserIds(tx: Prisma.TransactionClient, userIds: string[]) {
  for (const userId of [...new Set(userIds)].sort()) {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Wallet" WHERE "userId" = $1 FOR UPDATE', userId);
  }
}


async function runSerializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code !== 'P2034') throw error;
      if (attempt === 2) throw new AppError('Giao dịch đang được xử lý đồng thời. Vui lòng tải lại và thử lại.', 409);
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw new AppError('Không thể hoàn tất giao dịch sau nhiều lần thử.', 409);
}

export class PostgresEscrowService {
  /**
   * 1. Nạp tiền vào ví người dùng (Top-up Wallet) bằng Transaction
   */
  public static async creditVerifiedPaymentTx(paymentId: string) {
    return runSerializable(async (tx) => {
      const payment = await tx.paymentTransaction.findUnique({ where: { id: paymentId } });
      if (!payment || payment.status !== 'SUCCESS') {
        throw new AppError('Chỉ giao dịch đã được webhook ngân hàng xác thực mới được ghi có.', 409);
      }
      const referenceId = `PAYMENT:${payment.id}`;
      const existing = await tx.walletTransaction.findFirst({ where: { referenceId, type: 'TOPUP' } });
      if (existing) return existing;

      await tx.wallet.createMany({
        data: [{ userId: payment.userId, availableBalance: 0, lockedBalance: 0, totalDeposited: 0, totalWithdrawn: 0 }],
        skipDuplicates: true
      });
      await lockWalletsByUserIds(tx, [payment.userId]);
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: payment.userId } });
      const balBefore = wallet.availableBalance;
      const balAfter = balBefore.plus(payment.amount);
      await LedgerService.createPosting(tx, {
        eventType: 'BANK_IN',
        idempotencyKey: 'BANK_IN:PAYMENT:' + payment.id,
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        description: 'Nạp tiền ngân hàng đã xác thực ' + payment.referenceCode,
        lines: [
          { accountCode: 'BANK_CLEARING', accountName: 'Bank clearing asset', accountType: LedgerAccountType.ASSET, side: LedgerEntrySide.DEBIT, amount: payment.amount },
          { accountCode: 'USER_AVAILABLE:' + payment.userId, accountName: 'User available wallet liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.CREDIT, amount: payment.amount }
        ]
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: payment.amount },
          totalDeposited: { increment: payment.amount }
        }
      });
      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'TOPUP',
          amount: payment.amount,
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          referenceId,
          description: `Nạp tiền từ giao dịch ngân hàng đã xác thực ${payment.referenceCode}`
        }
      });
    });
  }

  /**
   * 2. Khóa ký quỹ (Lock Escrow) từ ví Người thuê bằng Transaction
   * - Trừ availableBalance, cộng lockedBalance
   * - Tạo / cập nhật EscrowTransaction sang trạng thái LOCKED
   * - Đổi Job status sang OPEN
   */
  public static async lockEscrowTx(
    jobId: string,
    posterId: string,
    amount: number
  ): Promise<EscrowTxResult> {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError('Số tiền ký quỹ không hợp lệ.', 400);

    return runSerializable(async (tx) => {
      await lockJobRow(tx, jobId);
      const job = await tx.job.findUnique({ where: { id: jobId } });
      if (!job) throw new AppError('Không tìm thấy công việc.', 404);
      if (job.posterId !== posterId) throw new AppError('Chỉ người đăng việc mới được ký quỹ.', 403);
      if (job.status !== 'DRAFT') throw new AppError('Công việc không còn ở trạng thái nháp.', 409);
      if (job.totalEstimatedVnd.toNumber() !== amount) throw new AppError('Số tiền ký quỹ phải đúng bằng ngân sách do máy chủ tính.', 400);

      const existingEscrow = await tx.escrowTransaction.findUnique({ where: { jobId } });
      if (existingEscrow) throw new AppError('Công việc đã có bản ghi ký quỹ; không thể khóa tiền lần nữa.', 409);

      await lockWalletsByUserIds(tx, [posterId]);
      const wallet = await tx.wallet.findUnique({ where: { userId: posterId } });
      if (!wallet) throw new AppError('Ví chưa có số dư được xác nhận.', 400);
      const balBefore = wallet.availableBalance;
      const balAfter = balBefore.minus(new Prisma.Decimal(amount));
      const debited = await tx.wallet.updateMany({
        where: { id: wallet.id, availableBalance: { gte: new Prisma.Decimal(amount) } },
        data: {
          availableBalance: { decrement: new Prisma.Decimal(amount) },
          lockedBalance: { increment: new Prisma.Decimal(amount) }
        }
      });
      if (debited.count !== 1) throw new AppError('Số dư khả dụng không đủ hoặc vừa thay đổi. Hãy tải lại ví.', 409);

      await LedgerService.createPosting(tx, {
        eventType: 'ESCROW_LOCK',
        idempotencyKey: 'ESCROW_LOCK:' + jobId,
        referenceType: 'JOB', referenceId: jobId,
        description: 'Khóa ký quỹ cho công việc ' + job.title + '; phí sàn 0%',
        lines: [
          { accountCode: 'USER_AVAILABLE:' + posterId, accountName: 'User available wallet liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.DEBIT, amount },
          { accountCode: 'ESCROW_JOB:' + jobId, accountName: 'Job escrow liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.CREDIT, amount }
        ]
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'ESCROW_LOCK',
          amount: new Prisma.Decimal(amount),
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          referenceId: jobId,
          description: `Khóa ký quỹ cho công việc: ${job.title}`
        }
      });

      const escrow = await tx.escrowTransaction.create({
        data: {
          jobId,
          grossAmount: new Prisma.Decimal(amount),
          platformFeeRate: 0,
          platformFeeVnd: new Prisma.Decimal(0),
          netWorkerPayout: new Prisma.Decimal(amount),
          status: 'LOCKED',
          lockedAt: new Date()
        }
      });
      await tx.job.update({ where: { id: jobId }, data: { status: 'OPEN' } });

      return {
        jobId,
        posterId,
        grossAmount: amount,
        platformFeeVnd: 0,
        netWorkerPayout: amount,
        status: escrow.status,
        lockedAt: escrow.lockedAt
      };
    });
  }

  /**
   * 3. Giải ngân 100% thù lao (Release Escrow) cho Worker bằng Transaction
   * - Trừ lockedBalance của Poster
   * - Cộng 100% netWorkerPayout vào availableBalance của Worker
   * - Tạo 2 bản ghi WalletTransaction đối soát độc lập
   * - Đổi EscrowTransaction sang RELEASED và Job sang COMPLETED
   */
  public static async releaseEscrowTx(
    jobId: string,
    approverId: string
  ): Promise<EscrowTxResult> {
    return runSerializable(async (tx) => {
      await lockJobRow(tx, jobId);
      const job = await tx.job.findUnique({
        where: { id: jobId },
        include: { escrowTransaction: true }
      });
      if (!job) throw new AppError(`Không tìm thấy ca việc ${jobId}`, 404);
      if (!job.workerId) throw new AppError('Ca việc chưa có Worker tiếp nhận', 400);
      if (job.posterId !== approverId) throw new AppError('Chỉ người đăng ca việc mới có quyền nghiệm thu và giải ngân.', 403);
      if (job.status !== 'PENDING_REVIEW') throw new AppError('Worker phải check-out trước khi người đăng nghiệm thu.', 409);

      const escrow = job.escrowTransaction;
      if (!escrow || escrow.status !== 'LOCKED') {
        throw new AppError('Khoản ký quỹ không ở trạng thái LOCKED.', 409);
      }

      await tx.wallet.createMany({
        data: [{ userId: job.workerId, availableBalance: 0, lockedBalance: 0, totalDeposited: 0, totalWithdrawn: 0 }],
        skipDuplicates: true
      });
      await lockWalletsByUserIds(tx, [job.posterId, job.workerId]);
      const posterWallet = await tx.wallet.findUnique({ where: { userId: job.posterId } });
      const workerWallet = await tx.wallet.findUnique({ where: { userId: job.workerId } });
      if (!posterWallet || !workerWallet || posterWallet.lockedBalance.lessThan(escrow.grossAmount)) {
        throw new AppError('Số dư ký quỹ không khớp sổ cái; đã dừng giải ngân để bảo toàn tiền.', 409);
      }

      const escrowChanged = await tx.escrowTransaction.updateMany({
        where: { jobId, status: 'LOCKED' },
        data: { status: 'RELEASED', releasedAt: new Date() }
      });
      if (escrowChanged.count !== 1) throw new AppError('Khoản ký quỹ đã được xử lý ở một yêu cầu khác.', 409);

      await LedgerService.createPosting(tx, {
        eventType: 'ESCROW_RELEASE',
        idempotencyKey: 'ESCROW_RELEASE:' + jobId,
        referenceType: 'JOB', referenceId: jobId,
        description: 'Giải ngân 100% cho Worker sau nghiệm thu; phí sàn 0%',
        lines: [
          { accountCode: 'ESCROW_JOB:' + jobId, accountName: 'Job escrow liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.DEBIT, amount: escrow.grossAmount },
          { accountCode: 'USER_AVAILABLE:' + job.workerId, accountName: 'Worker available wallet liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.CREDIT, amount: escrow.netWorkerPayout }
        ]
      });

      const posterBefore = posterWallet.availableBalance;
      const posterDebited = await tx.wallet.updateMany({
        where: { id: posterWallet.id, lockedBalance: { gte: escrow.grossAmount } },
        data: { lockedBalance: { decrement: escrow.grossAmount } }
      });
      if (posterDebited.count !== 1) throw new AppError('Số dư ký quỹ vừa thay đổi; đã dừng giải ngân.', 409);
      await tx.walletTransaction.create({
        data: {
          walletId: posterWallet.id,
          type: 'ESCROW_RELEASE',
          amount: escrow.grossAmount,
          balanceBefore: posterBefore,
          balanceAfter: posterBefore,
          referenceId: jobId,
          description: `Giải phóng khoản ký quỹ sau nghiệm thu: ${job.title}`
        }
      });

      const workerBefore = workerWallet.availableBalance;
      const workerAfter = workerBefore.plus(escrow.netWorkerPayout);
      await tx.wallet.update({
        where: { id: workerWallet.id },
        data: { availableBalance: { increment: escrow.netWorkerPayout } }
      });
      await tx.walletTransaction.create({
        data: {
          walletId: workerWallet.id,
          type: 'ESCROW_RELEASE',
          amount: escrow.netWorkerPayout,
          balanceBefore: workerBefore,
          balanceAfter: workerAfter,
          referenceId: jobId,
          description: `Nhận thù lao ca việc đã nghiệm thu: ${job.title}`
        }
      });

      await tx.job.update({
        where: { id: jobId },
        data: { status: 'COMPLETED' }
      });

      return {
        jobId,
        posterId: job.posterId,
        workerId: job.workerId,
        grossAmount: escrow.grossAmount.toNumber(),
        platformFeeVnd: escrow.platformFeeVnd.toNumber(),
        netWorkerPayout: escrow.netWorkerPayout.toNumber(),
        status: 'RELEASED',
        releasedAt: new Date()
      };
    });
  }

  /**
   * 4. Hoàn tiền ký quỹ (Refund Escrow) khi hủy việc bằng Transaction
   * - Trả lại lockedBalance về availableBalance của Poster
   */
  public static async refundEscrowTx(
    jobId: string,
    posterId: string,
    reason: string
  ): Promise<EscrowTxResult> {
    return runSerializable(async (tx) => {
      await lockJobRow(tx, jobId);
      const job = await tx.job.findUnique({
        where: { id: jobId },
        include: { escrowTransaction: true }
      });
      if (!job) throw new AppError('Không tìm thấy công việc.', 404);
      if (job.posterId !== posterId) throw new AppError('Chỉ người đăng việc mới có quyền yêu cầu hoàn ký quỹ.', 403);
      if (job.workerId || job.status !== 'OPEN') {
        throw new AppError('Công việc đã có người nhận hoặc đã bắt đầu; cần quy trình xử lý tranh chấp.', 409);
      }
      const escrow = job.escrowTransaction;
      if (!escrow || escrow.status !== 'LOCKED') throw new AppError('Không có khoản ký quỹ đang bị khóa.', 409);

      await lockWalletsByUserIds(tx, [job.posterId]);
      const wallet = await tx.wallet.findUnique({ where: { userId: job.posterId } });
      if (!wallet || wallet.lockedBalance.lessThan(escrow.grossAmount)) {
        throw new AppError('Sổ cái không khớp khoản ký quỹ; đã dừng hoàn tiền để bảo toàn số dư.', 409);
      }
      const changed = await tx.escrowTransaction.updateMany({
        where: { jobId, status: 'LOCKED' },
        data: { status: 'REFUNDED', refundedAt: new Date() }
      });
      if (changed.count !== 1) throw new AppError('Khoản ký quỹ đã được xử lý ở yêu cầu khác.', 409);

      await LedgerService.createPosting(tx, {
        eventType: 'ESCROW_REFUND',
        idempotencyKey: 'ESCROW_REFUND:' + jobId,
        referenceType: 'JOB', referenceId: jobId,
        description: 'Hoàn ký quỹ về ví người thuê: ' + reason.slice(0, 300),
        lines: [
          { accountCode: 'ESCROW_JOB:' + jobId, accountName: 'Job escrow liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.DEBIT, amount: escrow.grossAmount },
          { accountCode: 'USER_AVAILABLE:' + posterId, accountName: 'User available wallet liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.CREDIT, amount: escrow.grossAmount }
        ]
      });

      const before = wallet.availableBalance;
      const after = before.plus(escrow.grossAmount);
      const refundedWallet = await tx.wallet.updateMany({
        where: { id: wallet.id, lockedBalance: { gte: escrow.grossAmount } },
        data: {
          availableBalance: { increment: escrow.grossAmount },
          lockedBalance: { decrement: escrow.grossAmount }
        }
      });
      if (refundedWallet.count !== 1) throw new AppError('Số dư ký quỹ vừa thay đổi; đã dừng hoàn tiền.', 409);
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'ESCROW_REFUND',
          amount: escrow.grossAmount,
          balanceBefore: before,
          balanceAfter: after,
          referenceId: jobId,
          description: `Hoàn ký quỹ công việc: ${reason.slice(0, 500)}`
        }
      });
      await tx.job.update({ where: { id: jobId }, data: { status: 'CANCELLED' } });

      return {
        jobId,
        posterId: job.posterId,
        workerId: null,
        grossAmount: escrow.grossAmount.toNumber(),
        platformFeeVnd: 0,
        netWorkerPayout: 0,
        status: 'REFUNDED',
        refundedAt: new Date()
      };
    });
  }

  /**
   * 5. Rút tiền về tài khoản ngân hàng (Withdraw) bằng Transaction
   */
  public static async withdrawWalletTx(
    userId: string,
    amount: number,
    bankInfo: { bank: string; account: string; owner: string }
  ) {
    if (!Number.isSafeInteger(amount) || amount < 10000) throw new AppError('Số tiền rút không hợp lệ (tối thiểu 10.000 VNĐ).', 400);
    const requestId = 'WD-' + randomUUID();
    return runSerializable(async (tx) => {
      await lockWalletsByUserIds(tx, [userId]);
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new AppError('Không tìm thấy ví.', 404);
      const balBefore = wallet.availableBalance;
      const balAfter = balBefore.minus(new Prisma.Decimal(amount));
      const reserved = await tx.wallet.updateMany({
        where: { id: wallet.id, availableBalance: { gte: new Prisma.Decimal(amount) } },
        data: { availableBalance: { decrement: new Prisma.Decimal(amount) } }
      });
      if (reserved.count !== 1) throw new AppError('Số dư khả dụng không đủ hoặc vừa thay đổi.', 409);
      const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      await LedgerService.createPosting(tx, {
        eventType: 'WITHDRAWAL_REQUEST',
        idempotencyKey: 'WITHDRAWAL_REQUEST:' + requestId,
        referenceType: 'WITHDRAWAL',
        referenceId: requestId,
        description: 'Giữ tiền chờ đối soát và chuyển khoản qua PSP; chưa xác nhận đã chi tiền.',
        lines: [
          { accountCode: 'USER_AVAILABLE:' + userId, accountName: 'User available wallet liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.DEBIT, amount },
          { accountCode: 'PAYOUT_PENDING:' + userId, accountName: 'Pending bank payout liability', accountType: LedgerAccountType.LIABILITY, side: LedgerEntrySide.CREDIT, amount }
        ]
      });
      const lastFour = bankInfo.account.replace(/\\D/g, '').slice(-4);
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id, type: 'WITHDRAWAL', amount: new Prisma.Decimal(amount),
          balanceBefore: balBefore, balanceAfter: balAfter, referenceId: requestId,
          description: 'Yêu cầu rút tiền đang chờ PSP: ' + bankInfo.bank + ' (****' + lastFour + '). Chưa xác nhận chuyển khoản.'
        }
      });
      return { wallet: updatedWallet, transaction, payoutStatus: 'PENDING_PROVIDER' as const };
    });
  }
}
