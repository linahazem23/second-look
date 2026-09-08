-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "attachmentType" TEXT,
ADD COLUMN     "attachmentUrl" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerLastReadAt" TIMESTAMP(3),
ADD COLUMN     "sellerLastReadAt" TIMESTAMP(3);
