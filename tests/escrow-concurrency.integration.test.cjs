const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PostgresEscrowService } = require('../dist/modules/escrow/postgres-escrow.service.js');

const enabled = Boolean(process.env.DATABASE_URL);
const prisma = new PrismaClient();

test('20 concurrent escrow-lock attempts can debit a job budget only once', { skip: !enabled }, async () => {
  const token = randomUUID().replace(/-/g, '').slice(0, 10);
  const user = await prisma.user.create({
    data: { fullName: 'CI Concurrency Poster', phone: '+849' + token.slice(0, 8), passwordHash: 'ci-test-hash', role: 'POSTER' }
  });
  const job = await prisma.job.create({
    data: {
      posterId: user.id, title: 'Concurrent escrow test', description: 'CI-only test job',
      category: 'CI', status: 'DRAFT', startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000), hourlyRate: 100000,
      totalEstimatedVnd: 200000, lat: 18.34, lng: 105.9, addressText: 'CI test address'
    }
  });
  await prisma.wallet.create({
    data: { userId: user.id, availableBalance: 200000, lockedBalance: 0, totalDeposited: 200000, totalWithdrawn: 0 }
  });
  const key = 'ESCROW_LOCK:' + job.id;
  try {
    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, () => PostgresEscrowService.lockEscrowTx(job.id, user.id, 200000))
    );
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    const [wallet, escrow, postings] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: user.id } }),
      prisma.escrowTransaction.findUnique({ where: { jobId: job.id } }),
      prisma.ledgerPosting.findMany({ where: { idempotencyKey: key }, include: { lines: true } })
    ]);
    assert.equal(wallet.availableBalance.toNumber(), 0);
    assert.equal(wallet.lockedBalance.toNumber(), 200000);
    assert.equal(escrow.status, 'LOCKED');
    assert.equal(postings.length, 1);
    const debit = postings[0].lines.filter((line) => line.side === 'DEBIT').reduce((sum, line) => sum + line.amount.toNumber(), 0);
    const credit = postings[0].lines.filter((line) => line.side === 'CREDIT').reduce((sum, line) => sum + line.amount.toNumber(), 0);
    assert.equal(debit, 200000);
    assert.equal(credit, 200000);
  } finally {
    await prisma.ledgerLine.deleteMany({ where: { posting: { idempotencyKey: key } } });
    await prisma.ledgerPosting.deleteMany({ where: { idempotencyKey: key } });
    await prisma.ledgerAccount.deleteMany({ where: { code: { in: ['USER_AVAILABLE:' + user.id, 'ESCROW_JOB:' + job.id] } } });
    await prisma.escrowTransaction.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test.after(async () => prisma.$disconnect());
