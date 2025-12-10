-- AlterTable
ALTER TABLE "diagnostics" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'FR',
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "userName" TEXT;

-- CreateIndex
CREATE INDEX "diagnostics_country_idx" ON "diagnostics"("country");

-- CreateIndex
CREATE INDEX "diagnostics_userId_idx" ON "diagnostics"("userId");
