-- AlterTable
ALTER TABLE "goals" ALTER COLUMN "deadline" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "time_zone" TEXT;
