const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const enabled = Boolean(process.env.DATABASE_URL);
const prisma = new PrismaClient();

test('PostgreSQL migrations expose the fields required by the current API', { skip: !enabled }, async () => {
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'User' AND column_name = 'passwordHash')
        OR (table_name = 'CheckEvent' AND column_name = 'accuracyMeters')
      )
  `;
  const found = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
  assert.ok(found.has('User.passwordHash'));
  assert.ok(found.has('CheckEvent.accuracyMeters'));

  const adminRole = await prisma.$queryRaw`
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'ADMIN'
  `;
  assert.equal(adminRole.length, 1);

  const reviewIndexes = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Review_jobId_reviewerId_key'
  `;
  assert.equal(reviewIndexes.length, 1);

  const ledgerTables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('LedgerAccount', 'LedgerPosting', 'LedgerLine')
  `;
  assert.deepEqual(new Set(ledgerTables.map((row) => row.table_name)), new Set(['LedgerAccount', 'LedgerPosting', 'LedgerLine']));

  const paymentIntentGuard = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'PaymentTransaction_one_pending_per_job_key'
  `;
  assert.equal(paymentIntentGuard.length, 1);
});

test.after(async () => {
  await prisma.$disconnect();
});
