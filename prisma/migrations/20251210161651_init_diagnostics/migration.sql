-- CreateTable
CREATE TABLE "diagnostics" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitReports" JSONB NOT NULL DEFAULT '[]',
    "breakdowns" JSONB NOT NULL DEFAULT '[]',
    "maintenanceIssues" JSONB NOT NULL DEFAULT '[]',
    "repairRequests" JSONB,
    "analysis" JSONB,

    CONSTRAINT "diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostics_unitId_idx" ON "diagnostics"("unitId");

-- CreateIndex
CREATE INDEX "diagnostics_generatedAt_idx" ON "diagnostics"("generatedAt");

-- CreateIndex
CREATE INDEX "diagnostics_unitName_idx" ON "diagnostics"("unitName");

-- CreateIndex
CREATE INDEX "diagnostics_buildingName_idx" ON "diagnostics"("buildingName");
