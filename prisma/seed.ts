import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const phone = process.env.ADMIN_PHONE?.trim();
  const fullName = process.env.ADMIN_FULL_NAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (process.env.ADMIN_BOOTSTRAP_CONFIRM !== 'YES_I_UNDERSTAND') {
    throw new Error('Set ADMIN_BOOTSTRAP_CONFIRM=YES_I_UNDERSTAND only after verifying the target database and dedicated admin phone.');
  }
  if (!phone || !/^\+?[0-9]{9,15}$/.test(phone)) {
    throw new Error('ADMIN_PHONE is required and must contain 9-15 digits (optional leading +).');
  }
  if (!fullName || fullName.length < 2 || fullName.length > 100) {
    throw new Error('ADMIN_FULL_NAME is required and must contain 2-100 characters.');
  }
  if (!password || password.length < 14) {
    throw new Error('ADMIN_PASSWORD is required and must contain at least 14 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { phone }, select: { id: true, role: true } });
    if (existing && existing.role !== UserRole.ADMIN) {
      throw new Error('ADMIN_PHONE already belongs to a non-admin account. Use a dedicated admin identity; the seed will not promote a customer account.');
    }

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { fullName, passwordHash },
          select: { id: true, phone: true, fullName: true, role: true }
        })
      : await tx.user.create({
          data: { phone, fullName, role: UserRole.ADMIN, passwordHash },
          select: { id: true, phone: true, fullName: true, role: true }
        });

    await tx.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });

    return user;
  });

  // Never print the password or password hash.
  console.log(`Admin account ready: ${admin.fullName} (${admin.phone}) [${admin.role}]`);
}

main()
  .catch((error) => {
    console.error('Admin seed failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
