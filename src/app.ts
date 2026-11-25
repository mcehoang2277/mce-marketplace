import express, { Request } from 'express';
import cors from 'cors';

import { apiRouter } from './routes';
import { ENV } from './config/env';
import { errorHandler } from './core/errors/app-error';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({
    origin: (origin, callback) => {
      // Native clients commonly omit Origin. Browser origins must be allow-listed.
      if (!origin || ENV.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    }
  }));
  app.use(express.json({ limit: '1mb', verify: (req, _res, buffer) => { (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // The native Expo application is a separate client; this server exposes APIs only.
  app.use(ENV.API_PREFIX, apiRouter);
  app.use(errorHandler);

  return app;
}
