-- Tags a CommunityProductReview as belonging to the Mom & Baby space (null = general pool).
ALTER TABLE "CommunityProductReview" ADD COLUMN "category" TEXT;
