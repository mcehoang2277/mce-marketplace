import { Router } from 'express';

export const escrowRouter = Router();

// Escrow state is still held by a process-local Map. Do not expose operations
// that could be mistaken for durable funds custody or real payout processing.
escrowRouter.all('/escrow/:action', (_req, res) => {
  return res.status(503).json({
    success: false,
    status: 'ESCROW_UNAVAILABLE',
    message: 'Escrow đang tạm khóa cho đến khi ledger PostgreSQL, giao dịch nguyên tử và đối soát ngân hàng được triển khai.'
  });
});
