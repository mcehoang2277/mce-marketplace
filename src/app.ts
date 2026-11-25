import express, { Request } from 'express';
import cors from 'cors';
import path from 'node:path';

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

  // Serve the existing marketplace client and the new admin console.
  const projectRoot = path.resolve(__dirname, '..');
  app.get('/', (_req, res) => res.sendFile(path.join(projectRoot, 'index.html')));
  app.get('/admin', (_req, res) => res.sendFile(path.join(projectRoot, 'public', 'admin.html')));
  app.get('/admin/', (_req, res) => res.sendFile(path.join(projectRoot, 'public', 'admin.html')));

  // The native Expo application is a separate client; APIs remain under the configured prefix.
  app.use(ENV.API_PREFIX, apiRouter);
  app.use(errorHandler);

  return app;
}
