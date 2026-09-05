# Second Look

This workspace contains the production-ready scaffolding for the Second Look marketplace, including:

- Express + TypeScript backend API
- Prisma-ready database layer and schema directory
- Vite + React consumer app shell
- Admin tool structure and domain-driven data model

## Quick start

1. Install dependencies:
   npm install
2. Start server:
   npm run dev --workspace apps/server
3. Start web app:
   npm run dev --workspace apps/web
4. Open the consumer app at http://localhost:5173

## Notes

- This app intentionally implements the product rules as a realistic backend and data model scaffold, not a mock-only static prototype.
- The admin tool and consumer experience are intentionally structured to align with the specification, with production patterns and safeguards wired in.
- Deferred decisions such as minors policy, Paymob InstaPay confirmation, app-wrap-vs-native choice, and Arabic/RTL remain explicitly called out as product-owner inputs rather than silently decided.
