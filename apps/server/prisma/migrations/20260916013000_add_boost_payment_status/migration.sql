-- AlterTable
ALTER TABLE "BoostPayment" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymobOrderId" TEXT;
