import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../core/auth.middleware';
import { prisma } from '../core/database/prisma';

export const adminRouter = Router();

// All endpoints in this router require a valid session and a current ADMIN role.
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/admin/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [users, jobs, applications, payments, disputes, openDisputes, usersByRole] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.application.count(),
      prisma.paymentTransaction.count(),
      prisma.dispute.count(),
      prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } })
    ]);

    res.json({
      success: true,
      overview: {
        users,
        jobs,
        applications,
        payments,
        disputes,
        openDisputes,
        usersByRole: usersByRole.map((item) => ({ role: item.role, count: item._count._all }))
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20)
    }).safeParse(req.query);

    if (!query.success) {
      res.status(400).json({ success: false, error: { message: 'Tham số phân trang không hợp lệ.' } });
      return;
    }

    const { page, limit } = query.data;
    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
          karmaScore: true,
          isKycVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          wallet: {
            select: {
              availableBalance: true,
              lockedBalance: true
            }
          }
        }
      })
    ]);

    res.json({
      success: true,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      users
    });
  } catch (error) {
    next(error);
  }
});
