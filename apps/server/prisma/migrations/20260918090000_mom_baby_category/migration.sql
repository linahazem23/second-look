-- AlterEnum
ALTER TYPE "Category" ADD VALUE 'MomBaby';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isMother" BOOLEAN NOT NULL DEFAULT false;
