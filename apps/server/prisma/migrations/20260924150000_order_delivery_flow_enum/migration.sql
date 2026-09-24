-- New order lifecycle: Buy Now now reserves the listing and opens chat before
-- any payment. Delivery method is chosen first; only a paid courier method
-- moves the order into AwaitingPayment. Expired covers a hold that lapsed
-- before the buyer finished picking a method (and paying, if required).
ALTER TYPE "OrderEscrowStatus" ADD VALUE 'AwaitingDeliveryMethod';
ALTER TYPE "OrderEscrowStatus" ADD VALUE 'Expired';

ALTER TABLE "Order" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);
