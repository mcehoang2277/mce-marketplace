import { createApp } from './app';
import { ENV } from './config/env';

const app = createApp();

const server = app.listen(ENV.PORT, () => {
  console.log('========================================================================');
  console.log(`🚀 ${ENV.APP_NAME} — PRODUCTION SERVER IS RUNNING`);
  console.log(`📡 URL: http://localhost:${ENV.PORT}`);
  console.log(`👉 Web Portal: http://localhost:${ENV.PORT}/index.html`);
  console.log(`👉 Auth Portal: http://localhost:${ENV.PORT}/auth.html`);
  console.log(`👉 Health Check: http://localhost:${ENV.PORT}/api/health`);
  console.log('========================================================================');
});

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\nĐang dừng server an toàn...');
  server.close(() => {
    console.log('Server đã dừng hoàn toàn.');
    process.exit(0);
  });
});
