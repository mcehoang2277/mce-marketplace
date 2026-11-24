import { Router } from 'express';
import { jobRouter } from './job.routes';
import { escrowRouter } from './escrow.routes';
import { paymentRouter } from './payment.routes';
import { authRouter } from './auth.routes';
import { ENV } from '../config/env';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    app: ENV.APP_NAME,
    version: '1.2.0',
    architecture: 'Clean Architecture Modular Monolith',
    timestamp: new Date().toISOString()
  });
});

// Gắn kết các sub-routers
apiRouter.use(jobRouter);
apiRouter.use(escrowRouter);
apiRouter.use(paymentRouter);
apiRouter.use(authRouter);
