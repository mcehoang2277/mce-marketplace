import { Router } from 'express';
import { jobRouter } from './job.routes';
import { escrowRouter } from './escrow.routes';
import { paymentRouter } from './payment.routes';
import { authRouter } from './auth.routes';
import { ENV } from '../config/env';
import { prisma } from '../core/database/prisma';
import { walletRouter } from './wallet.routes';
import { adminRouter } from './admin.routes';

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

// Readiness includes the primary database, unlike the liveness endpoint above.
apiRouter.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'READY',
      dependencies: { database: 'ok' },
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      status: 'NOT_READY',
      dependencies: { database: 'unavailable' },
      timestamp: new Date().toISOString()
    });
  }
});

// Public client runtime configuration (non-secret values only).
apiRouter.get('/config/public', (_req, res) => {
  res.json({
    success: true,
    googleMapsApiKey: ENV.GOOGLE_MAPS_API_KEY,
    geofenceRadiusMeters: ENV.GEOFENCE_RADIUS_METERS,
    maxGpsAccuracyMeters: ENV.GPS_MAX_ALLOWED_ACCURACY_METERS
  });
});

// Gắn kết các sub-routers
apiRouter.use(jobRouter);
apiRouter.use(escrowRouter);
apiRouter.use(paymentRouter);
apiRouter.use(authRouter);
apiRouter.use(walletRouter);
apiRouter.use(adminRouter);
