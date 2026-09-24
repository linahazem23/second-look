-- Split into its own migration because Postgres won't let a newly added enum
-- value be referenced (even as a column DEFAULT) in the same transaction that
-- added it.
ALTER TABLE "Order" ALTER COLUMN "escrowStatus" SET DEFAULT 'AwaitingDeliveryMethod';
