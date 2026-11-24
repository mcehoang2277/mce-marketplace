import { PrismaClient } from '@prisma/client';
import { ENV } from '../../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __globalPrismaClient: PrismaClient | undefined;
}

export const prisma =
  global.__globalPrismaClient ||
  new PrismaClient({
    log: ENV.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (ENV.NODE_ENV !== 'production') {
  global.__globalPrismaClient = prisma;
}
