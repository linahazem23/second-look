-- CreateTable
CREATE TABLE "CommunityProductReview" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "productIdentity" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL,
    "photoUrls" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityProductReview_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CommunityProductReview" ADD CONSTRAINT "CommunityProductReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
