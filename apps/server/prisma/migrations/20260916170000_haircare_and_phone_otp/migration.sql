-- AlterEnum
ALTER TYPE "Category" ADD VALUE 'Haircare';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "hairType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneOtpCode" TEXT,
ADD COLUMN     "phoneOtpExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
