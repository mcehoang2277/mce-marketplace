const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PaymentService } = require('../dist/modules/payments/payment.service.js');

const enabled = Boolean(process.env.DATABASE_URL && process.env.VIETQR_ACCOUNT_NO && process.env.VIETQR_ACCOUNT_NAME);
const prisma = new PrismaClient();

test('20 concurrent payment-intent requests reuse one pending intent per job', { skip: !enabled }, async () => {
  const token = randomUUID().replace(/-/g, '').slice(0, 10);
  const user = await prisma.user.create({
    data: { fullName: 'CI Payment Intent Poster', phone: '+849' + token.slice(0, 8), passwordHash: 'ci-test-hash', role: 'POSTER' }
  });
  const job = await prisma.job.create({
    data: {
      posterId: user.id, title: 'Concurrent payment intent test', description: 'CI-only test job',
      category: 'CI', status: 'DRAFT', startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000), hourlyRate: 100000,
      totalEstimatedVnd: 200000, lat: 18.34, lng: 105.9, addressText: 'CI test address'
    }
  });
  try {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => PaymentService.createPaymentRequest({ userId: user.id, jobId: job.id }))
    );
    const ids = new Set(results.map((result) => result.paymentId));
    assert.equal(ids.size, 1);
    const pending = await prisma.paymentTransaction.findMany({ where: { jobId: job.id, status: 'PENDING' } });
    assert.equal(pending.length, 1);
    assert.equal(results[0].amountVnd, 200000);
  } finally {
    await prisma.paymentTransaction.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test.after(async () => prisma.$disconnect());
