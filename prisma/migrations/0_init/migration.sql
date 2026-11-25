-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('POSTER', 'WORKER', 'BOTH');
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'DISPUTED', 'CANCELLED');
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING', 'LOCKED', 'RELEASED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "RiskTier" AS ENUM ('TIER_1_LOW_RISK', 'TIER_2_MODERATE_RISK', 'TIER_3_PROHIBITED');
CREATE TYPE "CheckEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'WITHDRAWAL', 'PLATFORM_FEE');
CREATE TYPE "PaymentProvider" AS ENUM ('VIETQR', 'PAYOS', 'SEPAY', 'MOMO', 'VNPAY');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');

-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL UNIQUE,
    "role" "UserRole" NOT NULL DEFAULT 'BOTH',
    "karmaScore" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "isKycVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "idNumber" TEXT,
    "avatarUrl" TEXT,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "desiredMinRate" DECIMAL(12,2),
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountOwner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable Wallet
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "availableBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "lockedBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "totalDeposited" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "totalWithdrawn" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable WalletTransaction
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable Job
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "posterId" TEXT NOT NULL,
    "workerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "riskTier" "RiskTier" NOT NULL DEFAULT 'TIER_1_LOW_RISK',
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "hourlyRate" DECIMAL(12,2) NOT NULL,
    "totalEstimatedVnd" DECIMAL(12,2) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "addressText" TEXT NOT NULL,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Job_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable Application
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable EscrowTransaction
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL UNIQUE,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "platformFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "platformFeeVnd" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "netWorkerPayout" DECIMAL(12,2) NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING',
    "lockedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    CONSTRAINT "EscrowTransaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable PaymentTransaction
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'VIETQR',
    "referenceCode" TEXT NOT NULL UNIQUE,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transferContent" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "rawResponse" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentTransaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable WebhookEvent
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" "PaymentProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL UNIQUE,
    "signature" TEXT,
    "payload" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable CheckEvent
CREATE TABLE "CheckEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "eventType" "CheckEventType" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "photoProofUrl" TEXT,
    "deviceInfo" TEXT,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckEvent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable Dispute
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL UNIQUE,
    "initiatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "Dispute_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable Review
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL UNIQUE,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Indexes for Query Optimization
CREATE INDEX "User_phone_idx" ON "User"("phone");
CREATE INDEX "User_isKycVerified_idx" ON "User"("isKycVerified");
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");
CREATE INDEX "WalletTransaction_referenceId_idx" ON "WalletTransaction"("referenceId");
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");
CREATE INDEX "Job_status_idx" ON "Job"("status");
CREATE INDEX "Job_posterId_idx" ON "Job"("posterId");
CREATE INDEX "Job_workerId_idx" ON "Job"("workerId");
CREATE INDEX "Job_lat_lng_idx" ON "Job"("lat", "lng");
CREATE INDEX "Job_category_idx" ON "Job"("category");
CREATE UNIQUE INDEX "Application_jobId_workerId_key" ON "Application"("jobId", "workerId");
CREATE INDEX "Application_jobId_idx" ON "Application"("jobId");
CREATE INDEX "Application_workerId_idx" ON "Application"("workerId");
CREATE INDEX "Application_status_idx" ON "Application"("status");
CREATE INDEX "EscrowTransaction_jobId_idx" ON "EscrowTransaction"("jobId");
CREATE INDEX "EscrowTransaction_status_idx" ON "EscrowTransaction"("status");
CREATE INDEX "PaymentTransaction_referenceCode_idx" ON "PaymentTransaction"("referenceCode");
CREATE INDEX "PaymentTransaction_userId_idx" ON "PaymentTransaction"("userId");
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
CREATE INDEX "WebhookEvent_idempotencyKey_idx" ON "WebhookEvent"("idempotencyKey");
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");
CREATE INDEX "WebhookEvent_isProcessed_idx" ON "WebhookEvent"("isProcessed");
CREATE INDEX "CheckEvent_jobId_idx" ON "CheckEvent"("jobId");
CREATE INDEX "CheckEvent_workerId_idx" ON "CheckEvent"("workerId");
CREATE INDEX "CheckEvent_eventType_idx" ON "CheckEvent"("eventType");
CREATE INDEX "Review_reviewerId_idx" ON "Review"("reviewerId");
CREATE INDEX "Review_revieweeId_idx" ON "Review"("revieweeId");
