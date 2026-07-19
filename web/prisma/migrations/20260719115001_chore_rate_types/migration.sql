-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "rateUnits" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Chore" ADD COLUMN     "rateType" TEXT NOT NULL DEFAULT 'FLAT';
