import express from 'express';
import cors from 'cors';
import path from 'path';

import { apiRouter } from './routes';
import { errorHandler } from './core/errors/app-error';

export function createApp() {
  const app = express();

  // --- MIDDLEWARES ---
  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Phục vụ giao diện Web Client tĩnh (index.html, auth.html, v.v.)
  const publicDir = path.resolve(__dirname, '..');
  app.use(express.static(publicDir));

  // --- REST API ROUTES ---
  app.use('/api', apiRouter);

  // --- GLOBAL ERROR HANDLER ---
  app.use(errorHandler);

  return app;
}
