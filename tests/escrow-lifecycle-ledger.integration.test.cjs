const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PostgresEscrowService } = require('../dist/modules/escrow/postgres-escrow.service.js');

const enabled = Boolean(process.env.DATABASE_URL);
const prisma = new PrismaClient();

function phone() {
  return '+847' + Date.now().toString().slice(-8) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

async function createJob(posterId, title) {
  return prisma.job.create({
    data: {
      posterId, title, description: 'CI-only escrow lifecycle test', category: 'CI', status: 'DRAFT',
      startTime: new Date(Date.now() + 3600000), endTime: new Date(Date.now() + 7200000),
      hourlyRate: 100000, totalEstimatedVnd: 200000, lat: 18.34, lng: 105.9,
      addressText: 'CI test address'
    }
  });
}

async function assertBalanced(idempotencyKey) {
  const posting = await prisma.ledgerPosting.findUnique({ where: { idempotencyKey }, include: { lines: true } });
  assert.ok(posting);
  const debit = posting.lines.filter((line) => line.side === 'DEBIT').reduce((sum, line) => sum + line.amount.toNumber(), 0);
  const credit = posting.lines.filter((line) => line.side === 'CREDIT').reduce((sum, line) => sum + line.amount.toNumber(), 0);
  assert.equal(debit, credit);
}

test('escrow refund journals the release back to poster available funds', { skip: !enabled }, async () => {
  const poster = await prisma.user.create({
    data: { fullName: 'CI Refund Poster', phone: phone(), passwordHash: 'ci-test-hash', role: 'POSTER' }
  });
  const job = await createJob(poster.id, 'CI escrow refund test');
  await prisma.wallet.create({
    data: { userId: poster.id, availableBalance: 200000, lockedBalance: 0, totalDeposited: 200000, totalWithdrawn: 0 }
  });
  const keys = ['ESCROW_LOCK:' + job.id, 'ESCROW_REFUND:' + job.id];
  try {
    await PostgresEscrowService.lockEscrowTx(job.id, poster.id, 200000);
    const result = await PostgresEscrowService.refundEscrowTx(job.id, poster.id, 'CI cancellation test reason');
    const [wallet, updatedJob, escrow] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: poster.id } }),
      prisma.job.findUnique({ where: { id: job.id } }),
      prisma.escrowTransaction.findUnique({ where: { jobId: job.id } })
    ]);
    assert.equal(result.status, 'REFUNDED');
    assert.equal(wallet.availableBalance.toNumber(), 200000);
    assert.equal(wallet.lockedBalance.toNumber(), 0);
    assert.equal(updatedJob.status, 'CANCELLED');
    assert.equal(escrow.status, 'REFUNDED');
    await Promise.all(keys.map(assertBalanced));
  } finally {
    await prisma.ledgerLine.deleteMany({ where: { posting: { idempotencyKey: { in: keys } } } });
    await prisma.ledgerPosting.deleteMany({ where: { idempotencyKey: { in: keys } } });
    await prisma.ledgerAccount.deleteMany({ where: { code: { in: ['USER_AVAILABLE:' + poster.id, 'ESCROW_JOB:' + job.id] } } });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.user.delete({ where: { id: poster.id } });
  }
});

test('escrow release journals the full 0-percent-fee worker payout', { skip: !enabled }, async () => {
  const poster = await prisma.user.create({
    data: { fullName: 'CI Release Poster', phone: phone(), passwordHash: 'ci-test-hash', role: 'POSTER' }
  });
  const worker = await prisma.user.create({
    data: { fullName: 'CI Release Worker', phone: phone(), passwordHash: 'ci-test-hash', role: 'WORKER' }
  });
  const job = await createJob(poster.id, 'CI escrow release test');
  await prisma.wallet.create({
    data: { userId: poster.id, availableBalance: 200000, lockedBalance: 0, totalDeposited: 200000, totalWithdrawn: 0 }
  });
  const keys = ['ESCROW_LOCK:' + job.id, 'ESCROW_RELEASE:' + job.id];
  try {
    await PostgresEscrowService.lockEscrowTx(job.id, poster.id, 200000);
    await prisma.job.update({ where: { id: job.id }, data: { workerId: worker.id, status: 'PENDING_REVIEW' } });
    const result = await PostgresEscrowService.releaseEscrowTx(job.id, poster.id);
    const [posterWallet, workerWallet, updatedJob, escrow] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: poster.id } }),
      prisma.wallet.findUnique({ where: { userId: worker.id } }),
      prisma.job.findUnique({ where: { id: job.id } }),
      prisma.escrowTransaction.findUnique({ where: { jobId: job.id } })
    ]);
    assert.equal(result.status, 'RELEASED');
    assert.equal(posterWallet.lockedBalance.toNumber(), 0);
    assert.equal(workerWallet.availableBalance.toNumber(), 200000);
    assert.equal(escrow.platformFeeVnd.toNumber(), 0);
    assert.equal(escrow.netWorkerPayout.toNumber(), 200000);
    assert.equal(escrow.status, 'RELEASED');
    assert.equal(updatedJob.status, 'COMPLETED');
    await Promise.all(keys.map(assertBalanced));
  } finally {
    await prisma.ledgerLine.deleteMany({ where: { posting: { idempotencyKey: { in: keys } } } });
    await prisma.ledgerPosting.deleteMany({ where: { idempotencyKey: { in: keys } } });
    await prisma.ledgerAccount.deleteMany({
      where: { code: { in: ['USER_AVAILABLE:' + poster.id, 'USER_AVAILABLE:' + worker.id, 'ESCROW_JOB:' + job.id] } }
    });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.user.delete({ where: { id: poster.id } });
    await prisma.user.delete({ where: { id: worker.id } });
  }
});

test.after(async () => prisma.$disconnect());
