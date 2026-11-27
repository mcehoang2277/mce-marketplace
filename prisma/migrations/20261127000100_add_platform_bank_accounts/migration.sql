-- CreateTable
CREATE TABLE "PlatformBankAccount" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankBin" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountOwner" TEXT NOT NULL,
    "branch" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'SEPAY',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBankAccount_bankCode_accountNumber_key" ON "PlatformBankAccount"("bankCode", "accountNumber");

-- CreateIndex
CREATE INDEX "PlatformBankAccount_isActive_isDefault_idx" ON "PlatformBankAccount"("isActive", "isDefault");
