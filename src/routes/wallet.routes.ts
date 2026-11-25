import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../core/database/prisma';
import { requireAuth } from '../core/auth.middleware';

export const walletRouter = Router();

walletRouter.get('/wallet', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.auth!.id },
      select: {
        availableBalance: true,
        lockedBalance: true,
        totalDeposited: true,
        totalWithdrawn: true,
        updatedAt: true
      }
    });
    res.json({
      success: true,
      wallet: wallet ? {
        availableBalanceVnd: wallet.availableBalance.toNumber(),
        lockedBalanceVnd: wallet.lockedBalance.toNumber(),
        totalDepositedVnd: wallet.totalDeposited.toNumber(),
        totalWithdrawnVnd: wallet.totalWithdrawn.toNumber(),
        updatedAt: wallet.updatedAt
      } : {
        availableBalanceVnd: 0,
        lockedBalanceVnd: 0,
        totalDepositedVnd: 0,
        totalWithdrawnVnd: 0,
        updatedAt: null
      }
    });
  } catch (error) {
    next(error);
  }
});

walletRouter.get('/wallet/transactions', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '30'), 10) || 30));
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.auth!.id }, select: { id: true } });
    if (!wallet) return res.json({ success: true, transactions: [] });

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return res.json({
      success: true,
      transactions: transactions.map((item) => ({
        id: item.id,
        type: item.type,
        amountVnd: item.amount.toNumber(),
        balanceBeforeVnd: item.balanceBefore.toNumber(),
        balanceAfterVnd: item.balanceAfter.toNumber(),
        referenceId: item.referenceId,
        description: item.description,
        createdAt: item.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});
