import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/app-error';
import { Prisma } from '@prisma/client';

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

export class PostgresEscrowService {
  /**
   * 1. Nạp tiền vào ví người dùng (Top-up Wallet) bằng Transaction
   */
  public static async creditVerifiedPaymentTx(paymentId: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findUnique({ where: { id: paymentId } });
      if (!payment || payment.status !== 'SUCCESS') {
        throw new AppError('Chỉ giao dịch đã được webhook ngân hàng xác thực mới được ghi có.', 409);
      }
      const referenceId = `PAYMENT:${payment.id}`;
      const existing = await tx.walletTransaction.findFirst({ where: { referenceId, type: 'TOPUP' } });
      if (existing) return existing;

      let wallet = await tx.wallet.findUnique({ where: { userId: payment.userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: payment.userId,
            availableBalance: new Prisma.Decimal(0),
            lockedBalance: new Prisma.Decimal(0),
            totalDeposited: new Prisma.Decimal(0),
            totalWithdrawn: new Prisma.Decimal(0)
          }
        });
      }
      const balBefore = wallet.availableBalance;
      const balAfter = balBefore.plus(payment.amount);
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
    if (amount <= 0) throw new AppError('Số tiền ký quỹ phải lớn hơn 0', 400);

    return await prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId } });
      if (!job) throw new AppError(`Không tìm thấy ca việc ${jobId}`, 404);
      if (job.posterId !== posterId) {
        throw new AppError('Chỉ người tạo ca việc mới có quyền ký quỹ', 403);
      }

      const existingEscrow = await tx.escrowTransaction.findUnique({ where: { jobId } });
      if (existingEscrow && existingEscrow.status === 'LOCKED') {
        throw new AppError('Ca việc đã được ký quỹ trước đó.', 409);
      }

      const wallet = await tx.wallet.findUnique({ where: { userId: posterId } });
      if (!wallet || wallet.availableBalance.toNumber() < amount) {
        throw new AppError('Số dư ví không đủ. Chỉ khoản tiền đã được xác nhận và ghi có mới được dùng để ký quỹ.', 400);
      }

      const balBefore = wallet.availableBalance;
      const balAfter = balBefore.minus(new Prisma.Decimal(amount));
      const lockedAfter = wallet.lockedBalance.plus(new Prisma.Decimal(amount));

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balAfter,
          lockedBalance: lockedAfter
        }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'ESCROW_LOCK',
          amount: new Prisma.Decimal(amount),
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          referenceId: jobId,
          description: `Khóa cọc ký quỹ ca việc: ${job.title}`
        }
      });

      // MCE CAM KẾT 0% PHÍ SÀN TRONG GIAI ĐOẠN 2
      const platformFeeVnd = 0;
      const netWorkerPayout = amount;

      const escrow = await tx.escrowTransaction.upsert({
        where: { jobId },
        create: {
          jobId,
          grossAmount: new Prisma.Decimal(amount),
          platformFeeRate: 0.0,
          platformFeeVnd: new Prisma.Decimal(0),
          netWorkerPayout: new Prisma.Decimal(netWorkerPayout),
          status: 'LOCKED',
          lockedAt: new Date()
        },
        update: {
          grossAmount: new Prisma.Decimal(amount),
          platformFeeRate: 0.0,
          platformFeeVnd: new Prisma.Decimal(0),
          netWorkerPayout: new Prisma.Decimal(netWorkerPayout),
          status: 'LOCKED',
          lockedAt: new Date()
        }
      });

      await tx.job.update({
        where: { id: jobId },
        data: { status: 'OPEN' }
      });

      return {
        jobId,
        posterId,
        grossAmount: amount,
        platformFeeVnd,
        netWorkerPayout,
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
    return prisma.$transaction(async (tx) => {
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

      const posterWallet = await tx.wallet.findUnique({ where: { userId: job.posterId } });
      if (!posterWallet || posterWallet.lockedBalance.lessThan(escrow.grossAmount)) {
        throw new AppError('Số dư ký quỹ không khớp sổ cái; đã dừng giải ngân để bảo toàn tiền.', 409);
      }

      const escrowChanged = await tx.escrowTransaction.updateMany({
        where: { jobId, status: 'LOCKED' },
        data: { status: 'RELEASED', releasedAt: new Date() }
      });
      if (escrowChanged.count !== 1) throw new AppError('Khoản ký quỹ đã được xử lý ở một yêu cầu khác.', 409);

      const posterBefore = posterWallet.availableBalance;
      const posterLockedAfter = posterWallet.lockedBalance.minus(escrow.grossAmount);
      await tx.wallet.update({
        where: { id: posterWallet.id },
        data: { lockedBalance: { decrement: escrow.grossAmount } }
      });
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

      let workerWallet = await tx.wallet.findUnique({ where: { userId: job.workerId } });
      if (!workerWallet) {
        workerWallet = await tx.wallet.create({
          data: {
            userId: job.workerId,
            availableBalance: new Prisma.Decimal(0),
            lockedBalance: new Prisma.Decimal(0),
            totalDeposited: new Prisma.Decimal(0),
            totalWithdrawn: new Prisma.Decimal(0)
          }
        });
      }
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * 4. Hoàn tiền ký quỹ (Refund Escrow) khi hủy việc bằng Transaction
   * - Trả lại lockedBalance về availableBalance của Poster
   */
  public static async refundEscrowTx(
    jobId: string,
    reason: string
  ): Promise<EscrowTxResult> {
    return await prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({
        where: { id: jobId },
        include: { escrowTransaction: true }
      });

      if (!job) throw new AppError(`Không tìm thấy ca việc ${jobId}`, 404);
      const escrow = job.escrowTransaction;
      if (!escrow || escrow.status !== 'LOCKED') {
        throw new AppError(`Không thể hoàn tiền: Trạng thái ký quỹ là ${escrow?.status}`, 400);
      }

      const posterWallet = await tx.wallet.findUnique({ where: { userId: job.posterId } });
      if (posterWallet) {
        const balBefore = posterWallet.availableBalance;
        const balAfter = balBefore.plus(escrow.grossAmount);
        const lockedAfter = Prisma.Decimal.max(new Prisma.Decimal(0), posterWallet.lockedBalance.minus(escrow.grossAmount));

        await tx.wallet.update({
          where: { id: posterWallet.id },
          data: {
            availableBalance: balAfter,
            lockedBalance: lockedAfter
          }
        });

        await tx.walletTransaction.create({
          data: {
            walletId: posterWallet.id,
            type: 'ESCROW_REFUND',
            amount: escrow.grossAmount,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            referenceId: jobId,
            description: `Hoàn tiền cọc ca việc hủy: ${reason}`
          }
        });
      }

      const updatedEscrow = await tx.escrowTransaction.update({
        where: { jobId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date()
        }
      });

      await tx.job.update({
        where: { id: jobId },
        data: { status: 'CANCELLED' }
      });

      return {
        jobId,
        posterId: job.posterId,
        workerId: job.workerId,
        grossAmount: escrow.grossAmount.toNumber(),
        platformFeeVnd: 0,
        netWorkerPayout: 0,
        status: updatedEscrow.status,
        refundedAt: updatedEscrow.refundedAt
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
    if (amount < 10000) throw new AppError('Số tiền rút tối thiểu là 10.000 VNĐ', 400);

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || wallet.availableBalance.toNumber() < amount) {
        throw new AppError('Số dư khả dụng không đủ để rút tiền', 400);
      }

      const balBefore = wallet.availableBalance;
      const balAfter = balBefore.minus(new Prisma.Decimal(amount));

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balAfter,
          totalWithdrawn: wallet.totalWithdrawn.plus(new Prisma.Decimal(amount))
        }
      });

      const txRecord = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: new Prisma.Decimal(amount),
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          referenceId: `WD-${Date.now().toString().slice(-6)}`,
          description: `Rút tiền về ${bankInfo.bank} (${bankInfo.account} - ${bankInfo.owner})`
        }
      });

      return { wallet: updatedWallet, transaction: txRecord };
    });
  }
}
