-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymobOrderId" TEXT,
ALTER COLUMN "escrowStatus" SET DEFAULT 'AwaitingPayment';
