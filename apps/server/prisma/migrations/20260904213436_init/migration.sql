-- CreateEnum
CREATE TYPE "Category" AS ENUM ('Skincare', 'Makeup', 'Clothes');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NeverUsed', 'UsedOnce', 'UsedAFewTimes', 'RegularlyUsed');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Good', 'BuyOnlyRestricted', 'Blocked');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('Active', 'Removed', 'UnderReview', 'Sold');

-- CreateEnum
CREATE TYPE "OrderEscrowStatus" AS ENUM ('InEscrow', 'PaymentReleased', 'Disputed');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('Meetup', 'UberCourier', 'InDrive', 'BostaMylerz');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('Product', 'Person');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "languagePreference" TEXT NOT NULL DEFAULT 'en',
    "verifiedFemale" BOOLEAN NOT NULL DEFAULT false,
    "age" INTEGER,
    "kycStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" "UserStatus" NOT NULL DEFAULT 'Good',
    "buyOnlyUntil" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "lastFlagAt" TIMESTAMP(3),
    "completedSalesCount" INTEGER NOT NULL DEFAULT 0,
    "monetizationMode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidelineAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slideIndex" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidelineAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "reasonForSelling" TEXT NOT NULL,
    "condition" "Condition" NOT NULL,
    "allowOffers" BOOLEAN NOT NULL DEFAULT false,
    "size" TEXT,
    "images" TEXT[],
    "status" "ListingStatus" NOT NULL DEFAULT 'Active',
    "area" TEXT NOT NULL,
    "boosted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "area" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "boosted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandNotification" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "escrowStatus" "OrderEscrowStatus" NOT NULL DEFAULT 'InEscrow',
    "deliveryConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "deliveryConfirmedAt" TIMESTAMP(3),
    "paymentReleasedAt" TIMESTAMP(3),
    "reviewUnlockAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibleToOps" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewedUserId" TEXT NOT NULL,
    "type" "ReviewType" NOT NULL,
    "productIdentity" TEXT,
    "usageDuration" TEXT,
    "beforePhotoUrl" TEXT,
    "afterPhotoUrl" TEXT,
    "honestListing" BOOLEAN,
    "easyToCommunicate" BOOLEAN,
    "showedUpAsAgreed" BOOLEAN,
    "starRating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "revealDeadline" TIMESTAMP(3),
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "fraudSignals" TEXT[],
    "disputeStatus" TEXT NOT NULL DEFAULT 'none',
    "disputeNote" TEXT,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingReport" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detailText" TEXT,
    "originalPrice" DOUBLE PRECISION,
    "listedPrice" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'under_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewedUserId" TEXT,
    "flagTarget" TEXT NOT NULL DEFAULT 'reviewed',
    "status" TEXT NOT NULL DEFAULT 'open',
    "reason" TEXT NOT NULL,
    "reviewerNotes" TEXT,
    "reviewedNotes" TEXT,
    "notes" TEXT,
    "resolvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalDecision" TEXT NOT NULL,
    "originalModeratorId" TEXT,
    "statement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderatorId" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseDueAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "slotType" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "creativeUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoostPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoostPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flaggedKeyword" TEXT,
    "reported" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromSupport" BOOLEAN NOT NULL DEFAULT false,
    "quickReplyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'moderator',
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GuidelineAcceptance_userId_slideIndex_key" ON "GuidelineAcceptance"("userId", "slideIndex");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "GuidelineAcceptance" ADD CONSTRAINT "GuidelineAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandRequest" ADD CONSTRAINT "DemandRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandComment" ADD CONSTRAINT "DemandComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DemandRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandNotification" ADD CONSTRAINT "DemandNotification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DemandRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedUserId_fkey" FOREIGN KEY ("reviewedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoostPayment" ADD CONSTRAINT "BoostPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
