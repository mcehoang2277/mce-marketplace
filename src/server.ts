import { createApp } from './app';
import { ENV } from './config/env';

const app = createApp();

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const server = app.listen(ENV.PORT, () => {
    console.log('========================================================================');
    console.log(`🚀 ${ENV.APP_NAME} — PRODUCTION SERVER IS RUNNING`);
    console.log(`📡 URL: http://localhost:${ENV.PORT}`);
    console.log(`👉 API Base: http://localhost:${ENV.PORT}${ENV.API_PREFIX}`);
    console.log(`👉 Native client: configure EXPO_PUBLIC_API_URL=http://<host>:${ENV.PORT}${ENV.API_PREFIX}`);
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
}

export default app;

