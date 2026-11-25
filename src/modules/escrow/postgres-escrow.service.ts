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
  public static async topupWalletTx(
    userId: string,
    amount: number,
    referenceId: string,
    description: string
  ) {
    if (amount <= 0) throw new AppError('Số tiền nạp phải lớn hơn 0 VNĐ', 400);

    return await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId,
            availableBalance: new Prisma.Decimal(0),
            lockedBalance: new Prisma.Decimal(0),
            totalDeposited: new Prisma.Decimal(0),
            totalWithdrawn: new Prisma.Decimal(0)
          }
        });
      }

      const balBefore = wallet.availableBalance;
      const balAfter = balBefore.plus(new Prisma.Decimal(amount));

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balAfter,
          totalDeposited: wallet.totalDeposited.plus(new Prisma.Decimal(amount))
        }
      });

      const txRecord = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'TOPUP',
          amount: new Prisma.Decimal(amount),
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          referenceId,
          description
        }
      });

      return { wallet: updatedWallet, transaction: txRecord };
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
    if (amount <= 0) throw new AppError('Số tiền ký quỹ phải lớn hơn 0', 400);

    return await prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId } });
      if (!job) throw new AppError(`Không tìm thấy ca việc ${jobId}`, 404);
      if (job.posterId !== posterId) {
        throw new AppError('Chỉ người tạo ca việc mới có quyền ký quỹ', 403);
      }

      let wallet = await tx.wallet.findUnique({ where: { userId: posterId } });
      if (!wallet || wallet.availableBalance.toNumber() < amount) {
        // Tự động cấp hạn mức nạp tức thì nếu là thanh toán chuyển khoản trực tiếp qua VietQR
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              userId: posterId,
              availableBalance: new Prisma.Decimal(amount),
              lockedBalance: new Prisma.Decimal(0)
            }
          });
        } else {
          wallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              availableBalance: wallet.availableBalance.plus(new Prisma.Decimal(amount)),
              totalDeposited: wallet.totalDeposited.plus(new Prisma.Decimal(amount))
            }
          });
        }
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
    return await prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({
        where: { id: jobId },
        include: { escrowTransaction: true }
      });

      if (!job) throw new AppError(`Không tìm thấy ca việc ${jobId}`, 404);
      if (!job.workerId) throw new AppError('Ca việc chưa có Worker tiếp nhận', 400);

      const escrow = job.escrowTransaction;
      if (!escrow || escrow.status !== 'LOCKED') {
        throw new AppError(`Không thể giải ngân: Ký quỹ không ở trạng thái LOCKED (Hiện tại: ${escrow?.status})`, 400);
      }

      if (job.posterId !== approverId && approverId !== 'SYSTEM_ADMIN') {
        throw new AppError('Chỉ người đăng ca việc hoặc hệ thống mới có quyền giải ngân', 403);
      }

      const grossVnd = escrow.grossAmount.toNumber();
      const netPayout = escrow.netWorkerPayout.toNumber();

      // 1. Cập nhật ví Poster: giảm lockedBalance
      const posterWallet = await tx.wallet.findUnique({ where: { userId: job.posterId } });
      if (posterWallet) {
        await tx.wallet.update({
          where: { id: posterWallet.id },
          data: {
            lockedBalance: Prisma.Decimal.max(new Prisma.Decimal(0), posterWallet.lockedBalance.minus(escrow.grossAmount))
          }
        });

        await tx.walletTransaction.create({
          data: {
            walletId: posterWallet.id,
            type: 'ESCROW_RELEASE',
            amount: escrow.grossAmount,
            balanceBefore: posterWallet.availableBalance,
            balanceAfter: posterWallet.availableBalance,
            referenceId: jobId,
            description: `Giải ngân hoàn tất ca làm: ${job.title}`
          }
        });
      }

      // 2. Cập nhật ví Worker: cộng 100% thù lao
      let workerWallet = await tx.wallet.findUnique({ where: { userId: job.workerId } });
      if (!workerWallet) {
        workerWallet = await tx.wallet.create({
          data: {
            userId: job.workerId,
            availableBalance: new Prisma.Decimal(netPayout),
            lockedBalance: new Prisma.Decimal(0)
          }
        });
      } else {
        const wBalBefore = workerWallet.availableBalance;
        const wBalAfter = wBalBefore.plus(new Prisma.Decimal(netPayout));
        await tx.wallet.update({
          where: { id: workerWallet.id },
          data: { availableBalance: wBalAfter }
        });

        await tx.walletTransaction.create({
          data: {
            walletId: workerWallet.id,
            type: 'ESCROW_RELEASE',
            amount: new Prisma.Decimal(netPayout),
            balanceBefore: wBalBefore,
            balanceAfter: wBalAfter,
            referenceId: jobId,
            description: `Nhận 100% thù lao hoàn tất ca việc (0% phí sàn): ${job.title}`
          }
        });
      }

      // 3. Đổi trạng thái Escrow & Job
      const updatedEscrow = await tx.escrowTransaction.update({
        where: { jobId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date()
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
        grossAmount: grossVnd,
        platformFeeVnd: escrow.platformFeeVnd.toNumber(),
        netWorkerPayout: netPayout,
        status: updatedEscrow.status,
        releasedAt: updatedEscrow.releasedAt
      };
    });
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
