import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8000', 10),
  APP_NAME: process.env.APP_NAME || 'MCE Marketplace Core',
  API_PREFIX: process.env.API_PREFIX || '/api',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://mce_admin:mce_secure_password_2026@localhost:5432/mce_marketplace?schema=public',

  // JWT Security
  JWT_SECRET: process.env.JWT_SECRET || 'mce_super_secret_jwt_key_2026_production_at_least_32_bytes',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // VietQR / Banking
  VIETQR_BANK_CODE: process.env.VIETQR_BANK_CODE || 'MB',
  VIETQR_ACCOUNT_NO: process.env.VIETQR_ACCOUNT_NO || '0988888888',
  VIETQR_ACCOUNT_NAME: process.env.VIETQR_ACCOUNT_NAME || 'MCE VIETNAM ESCROW',
  WEBHOOK_HMAC_SECRET: process.env.WEBHOOK_HMAC_SECRET || 'mce_webhook_hmac_secret_key_2026',

  // Geofence & Anti-Spoofing Constants
  MAX_DISPATCH_RADIUS_KM: parseFloat(process.env.MAX_DISPATCH_RADIUS_KM || '6.0'),
  GEOFENCE_RADIUS_METERS: parseInt(process.env.GEOFENCE_RADIUS_METERS || '150', 10),
  GPS_MAX_ALLOWED_ACCURACY_METERS: parseInt(process.env.GPS_MAX_ALLOWED_ACCURACY_METERS || '50', 10),
  MAX_SPEED_KM_PER_HOUR: 120.0
};
