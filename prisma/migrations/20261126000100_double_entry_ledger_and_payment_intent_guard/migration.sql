-- Add an append-only double-entry journal and a concurrency guard for payment intents.
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "LedgerEntrySide" AS ENUM ('DEBIT', 'CREDIT');

CREATE TABLE "LedgerAccount" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accountType" "LedgerAccountType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");
CREATE INDEX "LedgerAccount_accountType_idx" ON "LedgerAccount"("accountType");

CREATE TABLE "LedgerPosting" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerPosting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerPosting_idempotencyKey_key" ON "LedgerPosting"("idempotencyKey");
CREATE INDEX "LedgerPosting_referenceType_referenceId_idx" ON "LedgerPosting"("referenceType", "referenceId");
CREATE INDEX "LedgerPosting_createdAt_idx" ON "LedgerPosting"("createdAt");

CREATE TABLE "LedgerLine" (
  "id" TEXT NOT NULL,
  "postingId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "side" "LedgerEntrySide" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerLine_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "LedgerLine_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "LedgerPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LedgerLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "LedgerLine_postingId_idx" ON "LedgerLine"("postingId");
CREATE INDEX "LedgerLine_accountId_createdAt_idx" ON "LedgerLine"("accountId", "createdAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PaymentTransaction"
    WHERE "status" = 'PENDING' AND "jobId" IS NOT NULL
    GROUP BY "jobId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple pending payment intents exist for one job. Reconcile them before applying the unique pending-payment index.';
  END IF;
END $$;

CREATE UNIQUE INDEX "PaymentTransaction_one_pending_per_job_key"
ON "PaymentTransaction"("jobId")
WHERE "status" = 'PENDING' AND "jobId" IS NOT NULL;
