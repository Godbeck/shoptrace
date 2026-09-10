# ShopTrace — Build Log

A running record of what was built, what was decided, and what broke along the way. Newest entries at the bottom.

---

## Session 1 — Project selection

Explored project ideas across several domains before settling. Ruled out two earlier batches of concepts. Requirements that emerged: something globally viable but useful locally, profitable, better than existing options, and deep enough on the backend to be worth learning from.

**Chose ShopTrace** — a product price comparison platform for Ghana. Prices vary widely across shops, nobody knows where to find what, and Jumia only covers online sellers. The gap is bridging physical shops with digital discovery.

---

## Session 2 — Architecture and stack

Started with a Supabase + PostGIS plan, then revised twice.

**Decision: MongoDB instead of PostgreSQL/Supabase.** Preference was to avoid Supabase. MongoDB's `2dsphere` geospatial support covers everything ShopTrace needs, and Mongoose pairs naturally with Express.

**Decision: standalone Express API, not Next.js API routes.** One backend serving both clients, independently deployable, and the mobile app stays decoupled from any web framework.

**Decision: JWT auth built in-house** rather than a hosted auth service. More work, but it is the piece most worth understanding.

Final stack: Expo React Native (mobile), Next.js (admin), Express (API), MongoDB Atlas, BullMQ + Upstash Redis, Paystack, Cloudinary.

---

## Session 3 — Design system and all 20 screens

**Palette went through four rounds.** Rejected: forest green (overused), a deep-indigo / burnt-orange / midnight-blue set, and midnight blue on its own. Landed on a deliberately narrow two-colour system.

**Final palette: cream `#FDF0D5` + near-black `#1A1A1A`.** Warm tan borders throughout instead of grey — this single detail is what keeps it from looking templated. No shadows, no gradients, no third accent, maximum font weight 500.

**Two-surface rule established.** Customer screens use a cream header; merchant and admin screens use an ink header. Tells users instantly which side of the marketplace they are on.

**Screens designed:** 3 shared/auth, 8 customer, 6 merchant, 3 admin. Mobile-first throughout.

**Correction during review:** bottom navigation was mistakenly included on Login and Register. Removed — auth screens are pre-authentication and must not show nav chrome.

**Correction during review:** merchant Analytics screen was missed in the original pass. Added — stat grid, revenue line chart, orders by weekday, top products by revenue, sales funnel.

**Decision: admin is web, not mobile.** The admin is built from desktop patterns — fixed sidebar, dense data tables, inline expanding rows. Redesigned as a 200px ink sidebar with a `#F7F3EC` content area.

---

## Session 4 — Mobile/web strategy

Question raised: could React Native Web serve the admin dashboard too, avoiding a second codebase?

**Decision: Option 2 — React Native for mobile, Next.js for admin.** React Native Web on desktop renders as a stretched mobile app, and the admin's data tables and multi-column layouts would take more effort to force than writing three Next.js pages. Shared logic lives in `packages/shared`.

---

## Session 5 — Learning plan

Backend is new territory, so learning runs in parallel with building.

- **React Native** — Net Ninja's beginner series, then his Expo series. Learned on the side while the API is built, so it's ready when the mobile app starts.
- **Node** — no dedicated course needed. Only three concepts matter: Node runs JS outside the browser, npm manages packages, `import` loads modules.
- **Prerequisites watched** — Traversy Media's Express crash course and MongoDB crash course.

Working pattern agreed: concept explained with a ShopTrace example → small example → step-by-step build instructions → code written and reviewed.

---

## Session 6 — Express server and MongoDB connection

**Built:** `server/` initialised with `express`, `dotenv`, `cors`, `nodemon`. Folder structure created. First `app.js` with a root route, JSON body parsing, and CORS. `"type": "module"` added for `import` syntax.

**Built:** `config/db.js` — Mongoose connection with `try/catch` and `process.exit(1)` on failure, since a server running without a database is useless.

**Bug found and fixed:** documents were landing in a database called `test`. Cause — the connection string had no database name between the `/` and the `?`. Adding `shoptrace` fixed it. The stray `test` database was dropped.

**Note:** server runs on port **4000**, not 5000.

---

## Session 7 — User model and auth

**Built:** `models/User.js` — name, email (unique, lowercase), phone (required, since Ghanaian identity and MoMo depend on it), password (min 6), role enum (`customer` / `merchant` / `admin`), timestamps.

Password hashing via a `pre('save')` hook guarded on `isModified('password')` — without that guard, updating a name would re-hash the already-hashed password and permanently break login. `matchPassword` added as a schema method.

Both use `function` rather than arrow syntax, since arrow functions don't bind `this`.

**Built:** `utils/generateToken.js`, `controllers/authController.js` (register, login), `routes/authRoutes.js`.

Security choices: password never returned in any response; identical error message for unknown email and wrong password, so the API doesn't disclose which emails are registered.

**Tested:** register returns 201 with a token, login returns 200 with a fresh token, user appears in Compass with the password hashed.

---

## Session 8 — Auth middleware

**Built:** `middleware/authMiddleware.js` with two exports.

`protect` — pulls the token from the `Authorization: Bearer` header, verifies it, loads the user with `.select('-password')`, attaches it as `req.user`. Handles the edge case of a valid token whose user has since been deleted.

`authorize(...roles)` — a factory returning middleware that checks the role against an allowlist. Used as `authorize('merchant')`.

401 vs 403 distinguished: 401 means identity unknown, 403 means identity known but insufficient.

**Built:** `GET /api/auth/me` behind `protect`, as a two-line controller — the middleware does the work.

**Tested:** no token → 401, valid token → user object, tampered token → 401. The third test is the one that proves it works.

---

## Session 9 — Shop model and geospatial search

**Built:** `models/Shop.js` — owner reference, name, category enum, phone, address, GeoJSON `location`, logo, opening hours, delivery settings, status enum defaulting to `pending`, `isFeatured`, `verifiedAt`.

`shopSchema.index({ location: '2dsphere' })` is the line that enables everything.

**Suggested during review and added:** `averageRating`, `reviewCount`, `suspendedAt`, `suspensionReason`.

Ratings deliberately stored as computed summaries rather than an embedded review array — a 16MB document limit and a search page needing 50 ratings both argue against embedding. `suspensionReason` matters practically: three weeks after a suspension, nobody remembers why.

Two extra indexes added: `{ status: 1, category: 1 }` and `{ averageRating: -1 }`.

**Built:** `shopController.js` — `createShop`, `getNearbyShops`, `getMyShop`, `getShopById`. Plus routes, mounted at `/api/shops`.

Key points: `req.user._id` supplies ownership, never the request body. Clients send `latitude`/`longitude`; the server flips to `[longitude, latitude]` for GeoJSON. `getNearbyShops` filters on `status: 'verified'`, so unapproved shops are invisible. `.populate('owner', 'name email')` whitelists fields.

**Bug hit:** a 403 on the nearby search. Traced to the request still being the earlier `POST /api/shops` — and separately, the server was on port 4000 while tests used 5000.

**Tested:**

- Accra coordinates, shop still `pending` → `count: 0` (status filter working)
- Verified the shop in Compass, same request → `count: 1`
- Kumasi coordinates, 5km radius → `count: 0`
- Kumasi coordinates, 300km radius → `count: 1`

The last two together prove real spherical distance calculation. Coordinates confirmed stored as `[-0.168, 5.635]`.

---

## Session 10 — Product and PriceHistory models

**Built:** `models/PriceHistory.js` — product and shop references, price, `previousPrice`, index `{ product: 1, createdAt: -1 }`. Storing both prices means the drop percentage needs no second lookup.

**Built:** `models/Product.js` — shop reference plus denormalised `shopName` and `location`, name, brand, category, price, stock, condition, images, `isFeatured` / `featuredUntil`, `viewCount`, `isActive`.

Four indexes: 2dsphere, text (name + brand + description), `{ shop, isActive }`, `{ category, price }`. Noted: only one text index is allowed per collection.

`isActive` implements soft delete — orders reference products, so hard deletion would break order history.

**Bug in my original hook implementation, found and fixed.** I tried to capture the old price inside `pre('save')`, but by then `this.price` already holds the new value — so `previousPrice` would always equal `price`.

**Fix implemented:** a `post('init')` hook stores `persistedPrice` at load time, before anything mutates it. `pre('save')` reads that when `isModified('price')`. `post('save')` writes the history record and resets the baseline for any subsequent save on the same instance. `next()` dropped from the hooks entirely, since Mongoose handles completion for zero-argument hooks.

Also noted: `post('init')` doesn't fire on `.aggregate()`, and the `post('save')` write isn't atomic with the product save — acceptable, since price history isn't financial data.

---

## Session 11 — Product controller

**Built:** `productController.js` — `createProduct`, `searchProducts`, `getProductById`, `getMyProducts`, `updateProduct`, `deleteProduct`, `getPriceHistory`. Plus routes at `/api/products`.

`searchProducts` uses an aggregation pipeline: `$geoNear` (mandatory first stage, writes a `distance` field, sorts nearest-first) → conditional `$match` built up filter by filter → `$sort` resolved through a lookup map with a safe fallback → `$skip` / `$limit`.

**MongoDB limitation documented:** `$text` is only permitted in the first aggregation stage, which `$geoNear` must occupy. Location-based search therefore uses `$regex` on name. The text index stays for a future global search endpoint.

Security patterns established here:

- Ownership comparison via `.toString()`, since ObjectId instances never match with `!==`
- `allowedFields` allowlist on update, preventing a merchant from sending `isFeatured: true`
- `product.save()` rather than `findByIdAndUpdate`, so hooks actually run
- `$inc` for `viewCount`, since read-modify-write loses concurrent views

**Concepts walked through in detail afterwards:** the check → do → respond shape shared by every controller; `req.params` vs `req.query` vs `req.body`; `.populate()` field whitelisting; why `$inc` is atomic; conditional filter-object building; the `$skip` performance ceiling.

---

## Session 12 — Order design decisions

Before writing any order code, several decisions were needed.

**Decision: orders can span multiple shops.** Correct for a price-comparison app, where the point is buying the cheapest of each item. Costs: delivery multiplies, payouts must split, partial cancellation gets complex. Schema built for it now; Paystack subaccount splitting deferred.

**Decision: distance-based delivery pricing, not a flat fee.** Raised the Kasoa-to-Tema case — roughly 50km, impossible to deliver for GH₵ 20. A flat fee doesn't remove that cost, it just moves it onto the platform. Formula: `baseFee + perKmRate × km`.

The real fix isn't the fee, though — it's that a shop outside its own range simply doesn't appear as a delivery option.

**Decision: platform sets all delivery pricing.** Merchants would otherwise set unworkable values. They get one three-option range selector (`area` ~8km / `city` ~35km / `nationwide`) and never type numbers.

**Decision: tiered location results.** Location-first as the default, but the escape hatch stays visible. Neighbourhood 0–8km, city 8–35km, regional beyond. A GH₵ 1,300 saving 14km away must not be hidden — that would defeat the app's purpose. Search results group into two labelled bands with anything further collapsed behind a savings line. Product detail ignores tiers entirely.

**Decision: delivery estimates are ranges, not promises.** A fixed "48hrs" claim becomes the platform's reputation problem when a rider takes four days, and there's no way to enforce it yet. "Delivery in 1–2 days" instead, with measured per-shop averages once real data exists.

**Decision: free delivery is a campaign, not a default.** My original schema had `freeDeliveryThreshold` always on at 500 — a straight loss on any long-distance order over that amount. Rebuilt as `freeDelivery` with `enabled: false` by default plus four guardrails: `minOrderValue`, `maxDistance`, `maxSubsidy`, `maxSubsidyPerOrder`, and a start/end date window.

`rawFee` and `subsidy` both returned and stored, so the interface can show struck-through pricing and the platform can audit promotion cost.

**Decision: phased monetisation.** Free launch → featured listings → tiered subscriptions, with a small percentage only on in-app payments. Rationale: the product's value is discovery, not payment processing, and most Ghanaian purchases will complete by phone or in person regardless. `platformFeePercent` defaults to `0`.

---

## Session 13 — Settings, delivery calculator, Order model

**Built:** `models/Settings.js` — singleton pattern keyed on `'platform'`, holding delivery config, free-delivery campaign, platform fee, order timeout, subscription tiers, featured listing price. `Settings.get()` is a static that lazily creates the document with defaults, so there's no null-config crash on a fresh install.

Subscription product limits live here rather than on shop documents — changing the free-tier allowance is one edit instead of a migration.

**Built:** `utils/deliveryCalculator.js` — `getDeliveryTier`, `calculateDeliveryFee`, `getDistanceMeters` (Haversine). The fee function accepts an optional pre-fetched settings object, so a multi-shop checkout doesn't hit the database once per shop.

Noted: Haversine is straight-line and under-estimates road distance by roughly 30% in a city.

**Built:** `Shop.js` additions — `subscriptionTier`, `subscriptionExpiresAt`, and `deliveryRange` enum replacing the `offersDelivery` boolean.

**Built:** `models/Order.js` — three nested schemas.

`orderItemSchema` with `{ _id: false }` stores a **snapshot**: name, brand, price, quantity, image, line total. Not a live reference. This is what lets an order display correctly a year later regardless of what happened to the product.

`subOrderSchema` — one per shop, with its own status enum, delivery method and fee, raw fee and subsidy, distance, tier, estimate, `statusHistory` array, and decline reason.

`orderSchema` — order number, customer snapshot, delivery address and location, sub-orders array, totals, payment status, Paystack reference, `expiresAt`.

`overallStatus` implemented as a virtual computed from sub-order statuses — `completed` only when all are, most-advanced-wins otherwise. `toJSON: { virtuals: true }` set, since virtuals are excluded from JSON by default.

Three indexes, including `{ paymentStatus: 1, expiresAt: 1 }` for the future expiry job.

---

## Session 14 — Order controller (written, not yet implemented)

Design and code produced in the session but **not yet written into the repo or tested.** Everything below is pending.

**Designed:** `utils/generateOrderNumber.js` — `ST-00001` format. Noted the collision risk under concurrency; a counter collection is the proper fix.

**Designed:** `orderController.js` — `createOrder`, `getMyOrders`, `getOrderById`, `getShopOrders`, `updateSubOrderStatus`, `cancelOrder`. Plus routes at `/api/orders`.

**Checkout flow:** validate cart → fetch all products in one `$in` query → group by shop into a `Map` → per shop, calculate distance and fee within the shop's range → reserve stock atomically item by item → build snapshotted sub-orders → compute totals → set `expiresAt`.

**Atomic stock reservation** via a conditional `findOneAndUpdate`: `{ _id, stockCount: { $gte: qty } }` with `$inc: -qty`. A null result means another request won the race. This is the pattern that prevents overselling.

**Rollback on partial failure:** a `reservations` array declared outside the `try` block accumulates every successful reservation. On any failure, including an unexpected throw, `releaseStock` increments everything back.

Documented honestly as manual compensation, not a transaction — a process crash between reservation and rollback leaves stock stuck. Chosen for readability while learning; MongoDB sessions are the known upgrade and Atlas M0 supports them.

**Subsidy budget across shops:** the loop tracks `totalSubsidyUsed` and reduces what later shops can claim, so a three-shop order can't triple the platform's promotion cost.

**Order state machine** as an explicit `ALLOWED_TRANSITIONS` map. Without it a merchant could jump `pending` straight to `completed`, or mark a declined order delivered. Declining or cancelling returns stock for every item in that sub-order.

**Privacy boundary in `getShopOrders`:** filters on `paymentStatus: 'paid'` so merchants never see orders that might expire, and reshapes the response so a merchant sees only their own sub-order. Other shops' items in the same customer basket must never leak.

**Graceful degradation:** if a shop's delivery range can't reach the customer, `deliveryMethod` stays `pickup` rather than erroring. The UI should surface this at cart stage.

---

## Session 15 — Design specification

Produced a complete handoff spec covering palette with hex values and roles, the two-surface rule, typography scale, shape and spacing tokens, component patterns, and all 20 screens described individually.

**Added screen 20 — admin Platform settings.** The backend config was built in session 13 but had no corresponding screen. Delivery pricing and the free-delivery campaign need somewhere to be edited.

Spec folds in post-design decisions: tiered search grouping, range-based delivery estimates, and the three-option merchant delivery selector.

Includes a "things to avoid" list — grey borders, drop shadows, weights above 500, all-caps labels, third accent colours, nav on auth screens, fixed delivery promises, merchant-editable fees.

---

## Current state

**Working and tested:**

- Express API on port 4000, MongoDB Atlas connected
- Register, login, JWT issuance, `protect` and `authorize` middleware
- Shop registration, geospatial nearby search proven across a 200km distance
- Product CRUD with ownership checks, aggregation search with filters and sort, automatic price history via hooks

**In the repo but not exercised:**

- `Settings` model and subscription tier fields — nothing calls `Settings.get()` yet, so the collection doesn't exist
- `deliveryCalculator.js` — no endpoint reaches it
- `Order` model — no documents created yet

**Designed but not written into the repo:**

- `generateOrderNumber.js`
- `orderController.js` and `orderRoutes.js` — the full checkout flow, atomic stock reservation, rollback path, state machine, and merchant order queue

**Not started:**

- Settings API endpoints (`GET` / `PATCH /api/settings`, admin only)
- Admin endpoints for shop approval and merchant management
- Paystack integration and payment webhooks
- Cloudinary image upload
- BullMQ jobs — order expiry sweep is the most urgent, since abandoned checkouts would otherwise hold stock indefinitely
- Review model
- PriceAlert model
- Mobile app
- Admin dashboard

**Immediate next steps:**

1. Write and test the order controller. The two things that need proving are the rollback path (over-order and confirm stock is unchanged afterwards) and the state machine (attempt an illegal transition and confirm it's rejected)
2. Settings API endpoints — so platform config is editable without Compass
3. Order expiry job — closes the stuck-stock gap
4. Paystack integration — orders currently have to be marked paid by hand
