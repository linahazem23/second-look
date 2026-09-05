# Second Look — Full Build Prompt

**Instructions for the AI/developer picking this up:** This document is the complete product specification for "Second Look," a peer-to-peer resale marketplace app. Everything in it has been through a full design process — visual identity, user flows, and trust/safety systems have already been prototyped and validated. Your job is to build this as a real, production application: backend, database, authentication, and integrations, not just UI. Two clickable HTML/CSS/JS prototypes already exist (one consumer-facing, one admin) — treat those as the source of truth for layout and interaction patterns, and this document as the source of truth for the underlying logic, rules, and data model they need to be backed by.

---

## 1. Product Overview

Second Look is a women-only, peer-to-peer resale marketplace app for Egypt, restricted to exactly three categories: **Skincare, Makeup, and Clothes** — no other categories, ever. Sellers list unwanted purchases at a discount from their original price; buyers can also post "I want this" requests, and the platform auto-matches supply and demand. Currency is EGP throughout.

The core differentiator versus existing options (OLX Egypt, informal Instagram/Facebook resale groups) is trust and safety infrastructure — identity-verified women-only membership, a moderated review system, and an active moderation team — not the marketplace mechanics themselves, which are intentionally simple. Don't let feature creep dilute this positioning.

---

## 2. Users & Identity Verification

- All users must be verified as female before gaining full access. Verification is automated via a KYC-style provider (e.g., Sumsub, iDenfy, or Entrust/Onfido) combining:
  - Government ID document OCR (reads the official sex field printed on the Egyptian national ID)
  - Live selfie with liveness detection (confirms a real person, not a photo of a photo)
  - Face-match between the selfie and the ID photo
- Expect roughly 90% automatic pass rate; route failures to manual human review. Budget a real per-verification cost (a few USD each) as an ongoing operating expense, not a one-time build cost.
- Community reporting/reviews serve as a secondary fallback signal for misuse that automated verification can't catch (e.g., a borrowed ID used with the owner's permission).
- **Age field**: collected at signup, feeding into backend analytics only (age-distribution reporting on the admin Overview dashboard).
- **Minors (under 18)**: OPEN, UNRESOLVED ITEM. Do not build a minors pathway without further legal/child-safety consultation. Specific open questions to resolve before any implementation: (a) whether Paymob or any payment processor allows minor account holders at all — industry-standard is no; (b) Egyptian civil law's age-of-contractual-capacity implications (full capacity generally starts at 21, limited capacity from 18) for a minor entering into a sale agreement; (c) if minors are ever permitted, chat supervision/restriction requirements beyond just restricting delivery method. A partial idea under consideration (not finalized) is restricting any future minor accounts to courier-only delivery (no in-person meetups) — but this alone does not address unsupervised chat risk and should not be treated as a complete solution.
- **Language**: English at launch. Include a language-preference field in profile/setup for future localization. Arabic + RTL support is explicitly out of scope for v1.

---

## 3. Core Marketplace Mechanics

### 3.1 Listings ("Sell")
Required fields, enforced at submission (form should not allow submit until all pass):
- **At least one photo — mandatory.**
- **Category**: Skincare / Makeup / Clothes (radio-style single select, no other options).
- **Item name** (free text).
- **Original price** and **your price** — always both required (no exception path for vintage/no-receipt items; sellers estimate based on comparable new item cost). **Your price must be strictly lower than original price** — block submission otherwise, show inline validation error, and show a positive "X% below original price" indicator when valid.
- **Reason for selling** (free text).
- **How many times used** (select: Never used / Used once / Used a few times / Regularly used).
- **Allow offers** (toggle). When on, buyers can propose a different price — negotiation happens directly in the chat thread between buyer and seller (no separate structured offer/counter-offer UI); seller accepts or declines within the conversation.
- **Sizes** (for Clothes): support up to **4XL**.
- Listings are **editable** after posting (price, photos, sold status, etc.).
- The moment an item sells (deal finalized), **remove it from active listings immediately** — no stale "still available" listings.

### 3.2 "I Want This" (Demand)
- Buyers post a want-request (item, category, note).
- Sellers in the relevant area get notified: "There's demand for X, do you have it?" with "I have it" / "Not now" actions. "Not now" must suppress repeat notifications for that request.
- Separate **Demand tab**: lists all open requests community-wide, each with "I can sell it" and "Leave a comment" (inline expanding comment box). Comments need moderation guardrails: no external contact info, no harassment.
- Trigger notifications only on posted requests (not on every search), ideally batched/digested to avoid spam.

### 3.3 Search & Discovery
- Keyword search bar across listings.
- Filter chips: price (sort ascending/descending), size, condition (times used), area/neighborhood, "allows offers."
- Show active filter/sort state and a result count.
- **Explore tab**: map view with pins per neighborhood cluster (e.g., Nasr City, Maadi, Zamalek, Heliopolis) showing active listing counts, tappable into an area-detail listing view. Also provide a list-view toggle as an alternative to the map.

### 3.4 Product Reviews vs. Person Reviews (important structural distinction)
Two separate review systems exist and must not be conflated:

**Product reviews** — answer "was this item as described / good quality."
- Gated to verified purchasers only.
- Require before/after photos and how long the reviewer used the product, plus a star rating.
- **Reviews attach to a canonical product identity, not to an individual listing.** If five different sellers list "the same" item (e.g., the same serum), their reviews should share one aggregated review pool for that product rather than each listing starting at zero reviews. This requires a lightweight product-matching/catalog layer behind the free-text listing name field (e.g., fuzzy-match or a curated product database) — treat this as real design work, not an afterthought.

**Person reviews** — answer "was this person reliable to deal with."
- After a transaction closes (see escrow trigger in section 4), both buyer and seller are prompted to rate each other.
- **Blind and simultaneous**: neither party sees the other's review until both have submitted, or a deadline passes (e.g., 7 days) — this prevents retaliation and pressure to change a review.
- Structured categories rather than free text alone, e.g.: *Honest listing/accurate description*, *Easy to communicate with*, *Showed up as agreed*.
- Aggregate score + completed-transaction count displayed on the person's public profile.
- **Reviews a person has left are also shown publicly on their own profile**, not just reviews they've received — this is a trust signal in itself.
- Sellers cannot see who left a review, or pressure someone to change it, before it posts.
- The reviewed party gets a **dispute button, not a delete button** — disputes route to a moderator, never to unilateral removal by the reviewed party.

### 3.5 Review Anti-Fraud
- A review can only be attached to a **real, confirmed order** — specifically, unlocked only after: delivery confirmed by buyer → payment released to seller via escrow (see section 5) → a minimum wait period has passed (5–7 days) before the review form unlocks. This prevents instant collusive/self-reviews and forces genuine product use before reviewing.
- **One review per order**, not per seller — prevents one real relationship being used to farm multiple reviews.
- Background (non-user-facing) fraud signals that flag cases for a moderator to look at — never auto-block:
  - Same device or same payment method appearing as both buyer and seller across multiple "transactions."
  - Unnatural review timing patterns (e.g., several reviews within an hour, near-identical wording).
  - "After" photo matching the seller's own listing photo via basic image hashing (indicates a re-uploaded product shot, not a real usage photo).

---

## 4. Moderation, Strikes, Appeals

### 4.1 Two Enforcement Speeds
- **Strike-based path** (for ambiguous, he-said-she-said disputes: low ratings, minor disputes, one-off rudeness): coach → restrict → block, as detailed below.
- **Immediate-action path** (for unambiguous severe violations: harassment, threats, clear fraud/scam behavior, sharing someone's personal info against their will, safety threats): can skip straight to a block — sometimes permanent on a first occurrence — at the moderation team's discretion. Do not force these through the full strike ladder.

### 4.2 Strike Ladder (from review-flag path)
- Trigger: any completed-order rating of 3 stars or below, OR an explicit report, escalates to human review. Avoid triggering full investigation on every single low rating in isolation once volume is real — consider requiring either an explicit report or a repeated pattern (2+ low ratings in a rolling window) to open a case, to keep moderator workload sustainable.
- A moderator reviews both sides: contacts the reviewer for their account, then the reviewed person for theirs. **This must be a genuine symmetric fork** — if the reviewed person's account holds up, the case should flip and the *reviewer* gets the coaching/strike instead, not the reviewed person automatically. Build the admin case-detail UI to make "flag the reviewer instead" an equally first-class action, not an afterthought.
- **1st flag**: private coaching message to the offending party. No visible mark, no restriction.
- **2nd flag**: **buy-only restriction for 7 days** — the user's active listings are removed and they cannot post new listings, but can still browse and buy normally.
- **3rd flag**: temporary block (14 days) — cannot browse, buy, or sell.
- Strikes should have a rolling expiration (e.g., 6–12 months of no further issues resets standing) so one old incident doesn't permanently threaten someone's account.
- **Critical rule: enforcement never interrupts an active mid-sale order.** If a user is blocked/restricted while a transaction is already in escrow, that transaction completes normally (payment releases as usual) — the restriction only applies going forward. This avoids ever needing special-case logic for "stuck" funds or items.
- **No returns policy.** Once delivery is confirmed and payment released, the transaction is final. If an item is a genuine mismatch, the buyer's remedy is to relist it themselves as a new listing, not request a refund through the platform.

### 4.3 Appeals
- A different moderator must review the appeal than the one who made the original decision — never a self-review of one's own call.
- The user must submit a real written explanation (not just an "unblock me" click).
- State a clear response window up front (e.g., 3 business days) and honor it.
- The decision — overturn or uphold — comes with a stated reason communicated back to the user, even if the outcome is "the restriction stands."

### 4.4 Reported Listings (separate track from review-flag moderation)
- **A single report is sufficient** to immediately move a listing to "Under review" and hide it from buyers — do not require multiple reports before acting, given a "take it seriously" posture on this.
- Report reasons should include, prominently, "Price seems unreasonable for the item's condition" (default-selected option) alongside photo-mismatch, authenticity concerns, and a free-text "something else."
- A moderator reviews the report and either **restores** the listing (back to Active) or **removes** it.
- **If the concern is pricing-related, the seller should also receive a coaching-tip message** — explicitly **not counted as a flag or strike**. This must be a functionally and visually separate action from the review-flag strike system in the admin tool, so moderators never conflate the two tracks.

### 4.5 Chat Moderation
- In-app chat between matched users. A **persistent, always-visible** in-chat notice states that conversations may be reviewed — not just a one-time signup checkbox.
- The moderation/admin team has **default visibility into all chats**, per the guidelines users agree to at signup — this is not conditional on a report being filed.
- Automatic keyword/pattern-based flagging of harassment or abusive language should highlight the specific flagged message inline in the admin chat view, tracked as an independent signal from user-initiated reports (a thread can be auto-flagged without being reported, and vice versa).
- Community guidelines are presented at signup as a **4-slide sequence**, each slide gated by **its own individual checkbox** (not one bundled agreement), ending in a completion state. **Log each slide's agreement individually with a timestamp** — this matters as evidence if enforcement is ever disputed later.

### 4.6 Delivery Safety Net (non-meetup transactions)
- Users may independently arrange external delivery via Uber Courier or inDrive Delivery (both operate in Egypt today) instead of meeting in person. The app does not need to integrate booking for these at launch — it's a "use an existing tool" pattern, not something to build/maintain.
- Courier fare is a separate charge from the item price, paid directly to the driver/app — the platform does not touch this payment.
- In the chat composer, alongside the existing report/flag icon, add a **separate "share delivery link" icon**. Submitting a tracking link posts it as its own distinct card in the thread (not a plain message), and it is **automatically and unconditionally saved to that order's record**, visible to the Second Look team at any time — this must not be gated behind someone filing a report first.

---

## 5. Payments & Revenue

### 5.1 Payment Gateway: Paymob
- **Stripe is not officially available for Egypt-based merchants** (confirmed against Stripe's own supported-country list) — do not build around it. Paymob is the chosen gateway: supports cards, mobile wallets, Meeza, and **Apple Pay** (live in Egypt since 2023 via local banks) under one integration.
- **Escrow flow**: buyer pays through Paymob → funds held by the platform → buyer confirms receipt in-app → funds released to the seller. This requires Paymob's marketplace/split-payment or mass-payout capability (paying out to individual sellers, not just to the business itself).
- **InstaPay is not an escrow mechanism** — it's an instant, final bank-to-bank transfer with no hold/release capability on its own. If used at all, it would only be as one funding rail feeding into the Paymob-held balance; confirm directly with Paymob whether they support InstaPay as an inbound rail.
- **Flag for legal review, not something to resolve in code**: holding buyer funds and disbursing to individual sellers is a payment-aggregation/marketplace-escrow model with real regulatory weight in Egypt (KYC on payees, anti-money-laundering considerations). Confirm compliance requirements with Paymob's onboarding team or a local fintech lawyer before launch.

### 5.2 Revenue Model — build for flexibility, not one fixed model
- **Launch free** — no fees at all initially, to prioritize liquidity (enough listings/buyers) over monetization.
- **Boost/visibility micro-payments** as the first paid feature to introduce (e.g., pay a small fee to feature a want-request or listing higher in the feed) — no escrow/payout infrastructure required, just a simple one-off charge.
- **Subscription and per-sale commission should both be supported as parallel, seller-selectable options — do not hard-code just one.** Trigger the choice at a seller's **5th completed sale**: at that point, offer them the option of a monthly "Seller Plus" subscription (unlimited listings, priority placement, lower/zero commission, boost credits) or continuing per-sale commission instead. Build the data model so a seller's chosen monetization mode can change over time.
- **Brand advertising**: two placement types — a full-width top-of-feed banner, and an in-feed sponsored card mixed into the regular grid (visually distinguished with a rose outline and a "Sponsored" tag so it's never confused with a peer's real listing). At launch, ad sales and placement are **manual** (a brand pays via a Paymob payment link, your team manually schedules the creative) — a self-serve brand dashboard is future scope, only worth building once manual deal volume becomes a bottleneck.

### 5.3 Shipping/Logistics
- **Default and only fully-supported method at launch: meetup**, using the existing neighborhood/area-cluster system (Explore tab).
- **Integrated courier (Bosta or Mylerz API)**: mark as "Coming soon" in the product now — do not build the integration yet.
- In the interim, support the external-courier safety pattern described in section 4.6 (Uber Courier / inDrive, with the shared tracking-link record).

---

## 6. Design System

### 6.1 Visual Identity
Deliberately avoids generic AI-generated design defaults (no cream+terracotta #F4F1EA/#D97757 combo, no ALL-CAPS eyebrow labels, no single-word-highlighted headlines, no numbered 01/02/03 markers unless content is genuinely sequential).

- **Palette**: primary accent rose `#D4638A`, darker rose `#C6597A`, soft rose `#F6D9E3`, blush background `#FBEEF2`, card surfaces `#FFFFFF` / `#FFF6F9`, primary text/ink `#5A2E3D`, secondary text `#8A5B6B`, faint text/borders `#C6A3B0` / `#F0D3DE`, olive/sage accent `#767B54` (used for calm, positive tags like match badges).
- **Typography**: **Fraunces** (serif) for headlines/display, **Karla** (sans) for body text — two clearly distinct families, both deliberate choices away from generic defaults.
- **Structural motifs**: arch-topped card shape specifically distinguishes Skincare/Makeup listings from rectangular Clothes cards (echoes both boho design language and Egyptian architectural vernacular — this is a functional signal of category, not decoration). Dashed "stitched" divider lines as a boho/embroidery-inspired structural device. Buttons use a layered lighter "shine" highlight strip near the top to approximate a glossy look (true CSS gradients/glow were not used in the prototype environment — a real build can use genuine gradients/shine for a more polished glossy/glittery effect if desired).

### 6.2 Navigation & Layout
- Mobile-first, responsive design (must work well on both mobile and desktop, but optimize for mobile).
- **Bottom tab navigation**: Home, Want, Demand, Explore, Chat.
- **Side/hamburger menu**: Reviews, My Profile, Community Guidelines.
- **Onboarding sequence**: welcome → profile quiz (skin type, clothing size up to 4XL, hair type) → 4-slide community guidelines (individually gated checkboxes) → completion.

### 6.3 Profile Page
- **Public**: active listings, reviews the person has *left* (not just received), aggregate rating, completed-order count, joined date, general area.
- **Private (owner-only)**: order history (past purchases and sales), saved/wishlist items.
- **New-seller framing**: brand-new sellers get a positive badge (e.g., "New here — be one of her first sales!") rather than a neutral/suspicious "0 reviews" treatment, plus a private warm welcome message shown to the seller herself upon posting her first listing. Lean into affirming, community-oriented "girl-to-girl" microcopy throughout the product generally, consistent with the women-only positioning — this is a deliberate tone choice, not just decoration.

### 6.4 Support
- Every user's chat list includes a **pinned "Second Look Support" conversation** at the top by default.
- Opening it surfaces a small set of pre-built FAQ quick-reply questions (e.g., "How do I get paid after I sell something?", "What if the item doesn't match the description?", "How does the buy-only restriction work?", "How do I ship without meeting in person?", "I want to report someone") before a real person is looped in, to reduce direct queue volume. **Treat the initial FAQ set as a starting guess — plan to revise it based on real support tickets once the app has real usage.**

---

## 7. Admin/Backend Tool ("Second Look Admin")

A separate, internal-only web tool (not customer-facing) for the moderation/operations team. Needs proper authentication and role-based access control before going live — the prototype has none, and that must be fixed before this touches real user data.

Sections required:

- **Overview**: key stats (active users, live listings, orders this week, open moderation cases, pending appeals, reported listings awaiting review) + a recent-orders table. Include age-distribution/demographic analytics sourced from the signup age field.
- **Users**: table with standing (Good / Restricted — buy only, with countdown / Blocked until [date]), completed-order count, flag count, joined date. Support the global search described below.
- **Listings**: table with status (Active / Removed / Under review), remove action. Status auto-updates to "Under review" the instant a report comes in (see below).
- **Orders**: table showing buyer, seller, item, amount, delivery method (Meetup / Uber Courier / inDrive / future Bosta-Mylerz), and escrow status (In escrow / Payment released / Disputed).
- **Moderation queue**: flagged review cases. Two-sided detail view with the reviewer's story/notes field and the reviewed person's history/notes field side by side. Actions: Coach [reviewed party], Escalate to warning, **Flag [reviewer] instead** (the symmetric fork — must be equally accessible, not buried), Dismiss case.
- **Appeals queue**: separate from the moderation queue. Shows the user's written statement. Overturn / Uphold actions, each requiring a reasoning note that gets communicated back to the user. Enforce (procedurally, and via assignment logic if feasible) that the reviewing moderator differs from whoever made the original decision.
- **Reported listings queue**: separate from both of the above. One report is sufficient to trigger this queue and hide the listing immediately. Shows report reason, detail text, and the original-vs-listed price comparison. Actions: Restore listing, Remove listing, and a clearly distinct "Send coaching tip" action explicitly labeled as not counting toward strikes.
- **Reviews**: table of all product and person reviews; flagged ones sort to the top.
- **Chats**: full visibility into every conversation by default. List view shows delivery method and whether a tracking link is on file. Thread detail shows the full message history with automatic keyword-flagged messages visually highlighted inline, the delivery-link record shown alongside (visible regardless of report status), and an "Open a case from this chat" action to escalate directly into the moderation queue.
- **Ads**: manually managed table of sponsored placements (slot type, brand, date range, status). "Add new placement" action.
- **Global search** (persistent across all admin pages): search by order number or user/seller name, with quick-jump results spanning orders, users, moderation cases, and reported listings.

---

## 8. Technical Notes for the Build

- **Current state**: two front-end-only prototypes exist (consumer app and admin tool), both single-file HTML/CSS/vanilla JS with in-memory state only — no backend, no database, no persistence, no real authentication, and no real integrations (payment, courier, ID verification are all mocked/simulated). Treat these strictly as **UX/flow references**, not code to extend directly into production.
- **Real build requirements**:
  - Backend + database (users, listings, orders, reviews, chats, moderation cases, appeals, reports — model these as genuinely separate entities per the sections above, not conflated).
  - Real authentication, integrated with the ID/selfie verification provider.
  - Paymob integration for payments, escrow holding, and payouts.
  - Real-time infrastructure (e.g., WebSockets) for actually-live chat updates between users and for the admin team's live visibility — this is a genuine backend requirement, not a UI toggle.
  - Push notification infrastructure, particularly for demand-match alerts.
  - Role-based access control and login for the admin tool.
  - Terms of Service and a Privacy Policy, with specific attention to Egypt's Personal Data Protection Law (151/2020) regarding the chat-monitoring disclosure.
  - Arabic/RTL localization is explicitly deferred, but the profile schema should include a language-preference field now so it isn't a retrofit later.
- **App vs. web**: not yet decided. Cheapest path to an installable app is wrapping the existing web app (e.g., via Capacitor) rather than a full native rebuild; a full cross-platform (Flutter/React Native) rebuild for a marketplace of this complexity runs roughly EGP 700,000–1,500,000+ in the current (2026) Egyptian market. Recommend validating with the wrapped-web approach before committing to a full native rebuild.

---

## 9. Explicitly Deferred / Not Yet Decided

Do not silently make decisions on these — surface them back to the product owner:
- Minors/under-18 policy (pending legal consultation — see section 2).
- Full integrated courier API (Bosta/Mylerz) — "coming soon" placeholder only for now.
- Self-serve brand advertising dashboard — manual process only for now.
- Arabic/RTL localization — v2 scope.
- Whether Paymob supports InstaPay as an inbound funding rail — needs direct confirmation from Paymob.
- App vs. wrapped-web vs. full native decision — cost information provided, decision not yet made.
