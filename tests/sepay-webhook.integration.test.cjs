const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.SEPAY_WEBHOOK_SECRET &&
  process.env.VIETQR_ACCOUNT_NO
);
const prisma = new PrismaClient();
let server;

test('SePay webhook funds escrow once and opens the job atomically', { skip: !enabled }, async () => {
  const { createApp } = require('../dist/app.js');
  const app = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const suffix = Date.now().toString();
  const user = await prisma.user.create({
    data: {
      fullName: 'CI Payment Poster',
      phone: `+849${suffix.slice(-8)}`,
      passwordHash: 'ci-test-hash',
      role: 'POSTER'
    }
  });
  const job = await prisma.job.create({
    data: {
      posterId: user.id,
      title: 'CI escrow funding job',
      description: 'Integration test job for verified SePay payment.',
      category: 'CI',
      status: 'DRAFT',
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      hourlyRate: 100000,
      totalEstimatedVnd: 200000,
      lat: 18.34,
      lng: 105.9,
      addressText: 'CI test address'
    }
  });
  const referenceCode = 'MCEABCDEF123456';
  const payment = await prisma.paymentTransaction.create({
    data: {
      userId: user.id,
      jobId: job.id,
      provider: 'SEPAY',
      referenceCode,
      amount: 200000,
      status: 'PENDING',
      transferContent: `MCE ${referenceCode}`
    }
  });

  const transactionId = Date.now();
  const payload = {
    id: transactionId,
    gateway: 'CI Bank',
    transactionDate: new Date().toISOString(),
    accountNumber: process.env.VIETQR_ACCOUNT_NO,
    subAccount: '',
    code: referenceCode,
    content: `MCE ${referenceCode}`,
    transferType: 'in',
    transferAmount: 200000,
    accumulated: 200000,
    referenceCode: `CI-${transactionId}`
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = 'sha256=' + createHmac('sha256', process.env.SEPAY_WEBHOOK_SECRET)
    .update(timestamp + '.')
    .update(rawBody)
    .digest('hex');

  const send = () => fetch(`${baseUrl}/api/webhook/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SePay-Timestamp': timestamp,
      'X-SePay-Signature': signature
    },
    body: rawBody
  });

  try {
    const rejected = await fetch(`${baseUrl}/api/webhook/payment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: rawBody
    });
    assert.equal(rejected.status, 401);

    const response = await send();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });

    const [updatedPayment, updatedJob, escrow, wallet, ledger, webhook] = await Promise.all([
      prisma.paymentTransaction.findUnique({ where: { id: payment.id } }),
      prisma.job.findUnique({ where: { id: job.id } }),
      prisma.escrowTransaction.findUnique({ where: { jobId: job.id } }),
      prisma.wallet.findUnique({ where: { userId: user.id } }),
      prisma.walletTransaction.findMany({ where: { referenceId: { in: [job.id, `PAYMENT:${payment.id}`] } } }),
      prisma.webhookEvent.findUnique({ where: { idempotencyKey: `SEPAY:${transactionId}` } })
    ]);

    assert.equal(updatedPayment.status, 'SUCCESS');
    assert.equal(updatedJob.status, 'OPEN');
    assert.equal(escrow.status, 'LOCKED');
    assert.equal(wallet.availableBalance.toNumber(), 0);
    assert.equal(wallet.lockedBalance.toNumber(), 200000);
    assert.equal(wallet.totalDeposited.toNumber(), 200000);
    assert.equal(ledger.length, 2);
    assert.equal(webhook.isVerified, true);
    assert.equal(webhook.isProcessed, true);

    const replays = await Promise.all(Array.from({ length: 20 }, () => send()));
    assert.ok(replays.every((replay) => replay.status === 200));
    const replayBodies = await Promise.all(replays.map((replay) => replay.json()));
    assert.ok(replayBodies.every((body) => body.success === true));
    const replayLedgerCount = await prisma.walletTransaction.count({
      where: { referenceId: { in: [job.id, `PAYMENT:${payment.id}`] } }
    });
    assert.equal(replayLedgerCount, 2);
    const replayJournalCount = await prisma.ledgerPosting.count({
      where: { idempotencyKey: { in: [`BANK_IN:${transactionId}`, `ESCROW_LOCK:${job.id}`] } }
    });
    assert.equal(replayJournalCount, 2);

    const suspenseId = transactionId + 1;
    const suspensePayload = { ...payload, id: suspenseId, content: 'MCEFFFFFFFFFFFF', transferAmount: 50000 };
    const suspenseRaw = Buffer.from(JSON.stringify(suspensePayload));
    const suspenseSignature = 'sha256=' + createHmac('sha256', process.env.SEPAY_WEBHOOK_SECRET)
      .update(timestamp + '.').update(suspenseRaw).digest('hex');
    const suspenseResponse = await fetch(`${baseUrl}/api/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SePay-Timestamp': timestamp, 'X-SePay-Signature': suspenseSignature },
      body: suspenseRaw
    });
    assert.equal(suspenseResponse.status, 200);
    const suspenseEvent = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: `SEPAY:${suspenseId}` } });
    assert.equal(suspenseEvent.isProcessed, true);
    assert.match(suspenseEvent.errorMessage, /SUSPENSE/);
    const suspensePosting = await prisma.ledgerPosting.findUnique({
      where: { idempotencyKey: `BANK_SUSPENSE:${suspenseId}` }, include: { lines: true }
    });
    assert.ok(suspensePosting);
    assert.equal(suspensePosting.lines.filter((line) => line.side === 'DEBIT').reduce((sum, line) => sum + line.amount.toNumber(), 0), 50000);
    assert.equal(suspensePosting.lines.filter((line) => line.side === 'CREDIT').reduce((sum, line) => sum + line.amount.toNumber(), 0), 50000);
  } finally {
    const postingKeys = [`BANK_IN:${transactionId}`, `ESCROW_LOCK:${job.id}`, `BANK_SUSPENSE:${transactionId + 1}`];
    await prisma.ledgerLine.deleteMany({ where: { posting: { idempotencyKey: { in: postingKeys } } } });
    await prisma.ledgerPosting.deleteMany({ where: { idempotencyKey: { in: postingKeys } } });
    await prisma.ledgerAccount.deleteMany({
      where: { code: { in: ['BANK_CLEARING', 'SUSPENSE', `USER_AVAILABLE:${user.id}`, `ESCROW_JOB:${job.id}`] } }
    });
    await prisma.webhookEvent.deleteMany({
      where: { idempotencyKey: { in: [`SEPAY:${transactionId}`, `SEPAY:${transactionId + 1}`] } }
    });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.paymentTransaction.delete({ where: { id: payment.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
