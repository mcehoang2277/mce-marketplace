-- Add GPS accuracy and allow each participant to review once per completed job.
ALTER TABLE "CheckEvent"
ADD COLUMN "accuracyMeters" DOUBLE PRECISION;

DROP INDEX IF EXISTS "Review_jobId_key";
CREATE UNIQUE INDEX "Review_jobId_reviewerId_key"
ON "Review"("jobId", "reviewerId");
