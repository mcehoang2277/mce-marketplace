import dotenv from 'dotenv';
dotenv.config();

const numberFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric environment variable: ${name}`);
  return value;
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: numberFromEnv('PORT', 8000),
  APP_NAME: process.env.APP_NAME || 'MCE Marketplace Core',
  API_PREFIX: process.env.API_PREFIX || '/api',

  // No embedded credentials. Configure DATABASE_URL in the runtime environment.
  DATABASE_URL: process.env.DATABASE_URL || '',

  // No fallback signing keys: authentication must not run with a known secret.
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  VIETQR_BANK_CODE: process.env.VIETQR_BANK_CODE || 'MB',
  VIETQR_ACCOUNT_NO: process.env.VIETQR_ACCOUNT_NO || '',
  VIETQR_ACCOUNT_NAME: process.env.VIETQR_ACCOUNT_NAME || '',
  WEBHOOK_HMAC_SECRET: process.env.WEBHOOK_HMAC_SECRET || '',
  SEPAY_WEBHOOK_SECRET: process.env.SEPAY_WEBHOOK_SECRET || '',

  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  MAX_DISPATCH_RADIUS_KM: numberFromEnv('MAX_DISPATCH_RADIUS_KM', 6),
  GEOFENCE_RADIUS_METERS: numberFromEnv('GEOFENCE_RADIUS_METERS', 150),
  GPS_MAX_ALLOWED_ACCURACY_METERS: numberFromEnv('GPS_MAX_ALLOWED_ACCURACY_METERS', 50),
  MAX_SPEED_KM_PER_HOUR: 120,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || ''
};
