-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "offerAmount" DOUBLE PRECISION,
ADD COLUMN     "offerStatus" TEXT,
ADD COLUMN     "offerByUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "guardianEmail" TEXT,
ADD COLUMN     "guardianConsentStatus" TEXT NOT NULL DEFAULT 'not_required',
ADD COLUMN     "guardianIdDocumentUrl" TEXT,
ADD COLUMN     "guardianConsentToken" TEXT,
ADD COLUMN     "guardianRejectionReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_guardianConsentToken_key" ON "User"("guardianConsentToken");
