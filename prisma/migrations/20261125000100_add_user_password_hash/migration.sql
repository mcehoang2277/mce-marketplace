ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';

ALTER TABLE "User"
ALTER COLUMN "passwordHash" DROP DEFAULT;

CREATE UNIQUE INDEX "Application_jobId_workerId_key" ON "Application"("jobId", "workerId");
