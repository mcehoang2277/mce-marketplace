import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../core/database/prisma';
import { requireAuth } from '../core/auth.middleware';
import { AppError } from '../core/errors/app-error';
import { findVietnamBank } from '../modules/payments/vietnam-banks';

export const walletRouter = Router();

const bankAccountSchema = z.object({
  bank: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().regex(/^[A-Za-z0-9]{6,20}$/, 'Số tài khoản ngân hàng phải gồm 6–20 ký tự chữ/số.'),
  accountOwner: z.string().trim().min(2).max(80)
});

function maskAccountNumber(accountNumber: string | null): string | null {
  if (!accountNumber) return null;
  if (accountNumber.length <= 4) return accountNumber;
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

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

walletRouter.get('/wallet/bank-accounts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.id },
      select: { bankName: true, bankAccountNumber: true, bankAccountOwner: true, fullName: true }
    });
    if (!user) throw new AppError('Không tìm thấy tài khoản.', 404);
    const bankMeta = findVietnamBank(user.bankName || '');
    const linked = Boolean(user.bankName && user.bankAccountNumber);
    res.json({
      success: true,
      bankAccount: linked ? {
        bankCode: bankMeta?.code || user.bankName,
        bankBin: bankMeta?.bin || null,
        bankName: bankMeta?.shortName || user.bankName,
        bankFullName: bankMeta?.fullName || user.bankName,
        accountNumber: user.bankAccountNumber,
        maskedAccountNumber: maskAccountNumber(user.bankAccountNumber),
        accountOwner: user.bankAccountOwner || user.fullName
      } : null
    });
  } catch (error) {
    next(error);
  }
});

walletRouter.put('/wallet/bank-accounts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = bankAccountSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Thông tin tài khoản ngân hàng không hợp lệ.', 400);
    const bankMeta = findVietnamBank(parsed.data.bank);
    if (!bankMeta) throw new AppError('Ngân hàng chưa có trong danh mục NAPAS 24/7 được hỗ trợ.', 400);

    const updated = await prisma.user.update({
      where: { id: req.auth!.id },
      data: {
        bankName: bankMeta.shortName,
        bankAccountNumber: parsed.data.accountNumber.toUpperCase(),
        bankAccountOwner: parsed.data.accountOwner.toUpperCase()
      },
      select: { bankName: true, bankAccountNumber: true, bankAccountOwner: true }
    });
    res.json({
      success: true,
      message: `Đã lưu tài khoản ${bankMeta.shortName} thành công.`,
      bankAccount: {
        bankCode: bankMeta.code,
        bankBin: bankMeta.bin,
        bankName: updated.bankName,
        bankFullName: bankMeta.fullName,
        accountNumber: updated.bankAccountNumber,
        maskedAccountNumber: maskAccountNumber(updated.bankAccountNumber),
        accountOwner: updated.bankAccountOwner
      }
    });
  } catch (error) {
    next(error);
  }
});

walletRouter.delete('/wallet/bank-accounts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.auth!.id },
      data: { bankName: null, bankAccountNumber: null, bankAccountOwner: null }
    });
    res.json({ success: true, message: 'Đã xóa liên kết tài khoản ngân hàng.' });
  } catch (error) {
    next(error);
  }
});
