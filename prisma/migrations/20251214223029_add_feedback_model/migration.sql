-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "diagnosticId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sectionLabel" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "category" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_diagnosticId_idx" ON "feedback"("diagnosticId");

-- CreateIndex
CREATE INDEX "feedback_userId_idx" ON "feedback"("userId");

-- CreateIndex
CREATE INDEX "feedback_createdAt_idx" ON "feedback"("createdAt");

-- CreateIndex
CREATE INDEX "feedback_sentiment_idx" ON "feedback"("sentiment");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "diagnostics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
