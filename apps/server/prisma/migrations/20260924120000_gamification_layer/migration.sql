-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "avatarPreset" TEXT,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "birthdayBoardHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storeCredit" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "giftPoolId" TEXT,
ADD COLUMN     "storeCreditApplied" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Charm" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCharm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "charmId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCharm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayGiftPool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "giftDescription" TEXT,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "raisedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BirthdayGiftPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftContribution" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymobOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "growthStage" INTEGER NOT NULL DEFAULT 0,
    "happiness" INTEGER NOT NULL DEFAULT 50,
    "lastFedAt" TIMESTAMP(3),
    "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetItemCatalog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "effect" INTEGER NOT NULL,

    CONSTRAINT "PetItemCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetInventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PetInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Charm_key_key" ON "Charm"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserCharm_userId_charmId_key" ON "UserCharm"("userId", "charmId");

-- CreateIndex
CREATE UNIQUE INDEX "PointsLedger_userId_reason_refId_key" ON "PointsLedger"("userId", "reason", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "PetItemCatalog_key_key" ON "PetItemCatalog"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PetInventory_userId_itemKey_key" ON "PetInventory"("userId", "itemKey");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_giftPoolId_fkey" FOREIGN KEY ("giftPoolId") REFERENCES "BirthdayGiftPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCharm" ADD CONSTRAINT "UserCharm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCharm" ADD CONSTRAINT "UserCharm_charmId_fkey" FOREIGN KEY ("charmId") REFERENCES "Charm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayGiftPool" ADD CONSTRAINT "BirthdayGiftPool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftContribution" ADD CONSTRAINT "GiftContribution_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "BirthdayGiftPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftContribution" ADD CONSTRAINT "GiftContribution_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetInventory" ADD CONSTRAINT "PetInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SeedData: Charm catalog
INSERT INTO "Charm" ("id", "key", "label", "description", "icon") VALUES
('first_sale', 'first_sale', 'First Sale', 'Completed your first sale as a seller.', '🏅'),
('trusted_reviewer', 'trusted_reviewer', 'Trusted Reviewer', 'Left 5 or more reviews.', '⭐'),
('community_helper', 'community_helper', 'Community Helper', 'Posted or replied 10 or more times in Community.', '💬'),
('referral_star', 'referral_star', 'Referral Star', 'Brought a friend to Second Look.', '🌟'),
('gift_giver', 'gift_giver', 'Gift-Giver', 'Contributed to someone''s birthday gift pool.', '🎁');

-- SeedData: pet shop catalog
INSERT INTO "PetItemCatalog" ("id", "key", "name", "pointsCost", "kind", "effect") VALUES
('apple', 'apple', 'Apple', 5, 'food', 5),
('treat', 'treat', 'Yummy Treat', 10, 'food', 10),
('feast', 'feast', 'Big Feast', 25, 'food', 25),
('ball', 'ball', 'Bouncy Ball', 15, 'toy', 10),
('plush', 'plush', 'Cuddly Plush', 20, 'toy', 15),
('bow', 'bow', 'Cute Bow', 30, 'accessory', 5),
('hat', 'hat', 'Tiny Hat', 30, 'accessory', 5),
('crown', 'crown', 'Sparkly Crown', 50, 'accessory', 10);
