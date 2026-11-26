const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { LedgerService } = require('../dist/modules/ledger/ledger.service.js');

const enabled = Boolean(process.env.DATABASE_URL);
const prisma = new PrismaClient();

test('double-entry ledger rejects unbalanced postings and is idempotent', { skip: !enabled }, async () => {
  const suffix = randomUUID();
  const debitCode = 'TEST_ASSET:' + suffix;
  const creditCode = 'TEST_LIABILITY:' + suffix;
  const key = 'TEST_POSTING:' + suffix;
  const valid = {
    eventType: 'TEST',
    idempotencyKey: key,
    referenceType: 'TEST',
    referenceId: suffix,
    description: 'Automated ledger invariant test',
    lines: [
      { accountCode: debitCode, accountName: 'Test asset', accountType: 'ASSET', side: 'DEBIT', amount: 125000 },
      { accountCode: creditCode, accountName: 'Test liability', accountType: 'LIABILITY', side: 'CREDIT', amount: 125000 }
    ]
  };
  try {
    await assert.rejects(
      prisma.$transaction((tx) => LedgerService.createPosting(tx, {
        ...valid,
        idempotencyKey: key + ':BAD',
        lines: [valid.lines[0], { ...valid.lines[1], amount: 120000 }]
      })),
      /debits must equal credits/
    );
    const first = await prisma.$transaction((tx) => LedgerService.createPosting(tx, valid));
    const second = await prisma.$transaction((tx) => LedgerService.createPosting(tx, valid));
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    const stored = await prisma.ledgerPosting.findUnique({ where: { idempotencyKey: key }, include: { lines: true } });
    assert.equal(stored.lines.length, 2);
    const debit = stored.lines.filter((line) => line.side === 'DEBIT').reduce((sum, line) => sum + line.amount.toNumber(), 0);
    const credit = stored.lines.filter((line) => line.side === 'CREDIT').reduce((sum, line) => sum + line.amount.toNumber(), 0);
    assert.equal(debit, 125000);
    assert.equal(credit, 125000);
  } finally {
    await prisma.ledgerLine.deleteMany({ where: { posting: { idempotencyKey: key } } });
    await prisma.ledgerPosting.deleteMany({ where: { idempotencyKey: key } });
    await prisma.ledgerAccount.deleteMany({ where: { code: { in: [debitCode, creditCode] } } });
  }
});

test.after(async () => prisma.$disconnect());
