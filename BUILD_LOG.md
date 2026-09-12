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

## Session 16 — Server completed and tested

The whole remaining server was built in one pass and exercised against Atlas. Everything below was actually run, not just written.

**Built: `models/Counter.js` + `utils/generateOrderNumber.js`.** Order numbers now come from an atomic `$inc` on a counter document rather than `countDocuments() + 1`. The collision risk documented in session 14 was skipped rather than shipped — the counter is about ten lines and strictly correct. Proved under load: six simultaneous checkouts produced six distinct numbers.

**Built: `utils/stock.js`** — `reserveStock`, `releaseStock`, `reservationsFromItems`, shared by the order controller and the expiry job.

**Deviation from the documented `$inc` pattern, deliberately.** Stock writes use an aggregation-pipeline update (two `$set` stages) instead of `$inc`. Reason: `inStock` is derived from `stockCount` by a `pre('save')` hook, and `findOneAndUpdate` bypasses document middleware — so a plain `$inc` would leave `inStock: true` on a product that had just hit zero. The pipeline recalculates `inStock` from the value it just wrote, inside the same atomic operation. Mongoose 9 requires `{ updatePipeline: true }` before it will pass an array through as an update; without it the call throws.

**Gap closed: range → kilometres.** `getRangeMaxDistance` maps `area` / `city` / `nationwide` onto the platform's radius settings. Nothing previously turned the merchant's word into a distance, so checkout had no way to ask "can this shop reach the customer".

**Gap closed: the per-order subsidy cap was unenforceable.** `settings.delivery.freeDelivery.maxSubsidyPerOrder` existed but nothing read it, and `calculateDeliveryFee` had no parameter for it. It now takes a fourth argument, `remainingSubsidyBudget`. Verified across three shops: 25 + 15 + 0 = the 40 cap, instead of 75.

**Built: `orderController.js` and `orderRoutes.js`.** Checkout, customer history, merchant queue, order detail, state machine, cancellation.

Checkout validates and merges duplicate cart lines, fetches every product in one `$in` query, re-checks that each shop is still verified, groups by shop, reserves atomically item by item, snapshots each line, prices delivery per shop, and computes every total server-side.

Failure paths throw a `CheckoutError` rather than returning. That was the design decision that mattered: an early `return` skips the `catch` block, and the `catch` block is what releases reserved stock. One exit path, one rollback.

**Proved the rollback.** An order for 2 phones (in stock) plus 99 bags of cement (only 2 in stock) returned 409 with the cement named, and both products were left at their original counts.

**Proved the atomicity.** Stock set to 2, six simultaneous checkouts fired: exactly two got 201, four got 409, stock landed on 0 and never went negative, `inStock` flipped to false.

**Proved the state machine.** `pending → completed` and `pending → out_for_delivery` both rejected with the allowed transitions listed. The legal path ran through to `completed`. `completed → packed` rejected. A pickup sub-order refused `out_for_delivery` and a delivery sub-order refused `ready_for_pickup`.

**Proved the privacy boundary.** On a two-shop order, `getShopOrders` returned one sub-order, the requesting shop's own, with no `grandTotal` and no trace of the other shop's items. A third merchant not in the order got 403 on both read and update.

**Graceful degradation confirmed.** A Kumasi shop 201km away with `area` range came back as `pickup` with a zero fee rather than an error, exactly as intended.

**Built: `utils/expireOrders.js`** and wired it to both the scheduled job and `POST /api/admin/jobs/expire-orders`, so the sweep can be tested without Redis. Proved it: an unpaid order held 3 units, the sweep released them and set `paymentStatus: 'failed'`, and a second run found 0 orders and did not double-release.

**Built: Settings API.** `GET /api/settings` and `PATCH /api/settings` (admin), plus `GET /api/settings/public` for the clients that legitimately need the radius values to group search results. The PATCH flattens the nested body into dot-paths and checks them against an allowlist, rejecting unknown paths with a 400 rather than ignoring them silently — an admin who typos a field name should be told.

**Built: admin endpoints.** Shop list and filter, verify, suspend (reason required), subscription tier, feature toggle, user list, role change, order list, platform stats, manual expiry sweep, shop-name sync trigger. `router.use(protect, authorize('admin'))` guards the whole router in one line.

**Security bug found and fixed in existing code.** `registerUser` took `role` straight from the request body, so anyone could register as an admin and own the platform. Registration is now limited to `customer` and `merchant`; admins are promoted by an existing admin or seeded with `npm run seed:admin`. Verified: a request asking for `admin` comes back as `customer`.

**Built: Paystack integration.** `utils/paystack.js` (initialize, verify, HMAC-SHA512 signature check, refund), `paymentController.js`, and the webhook.

The webhook is mounted directly in `app.js` above `express.json()` with `express.raw()`. Paystack signs the exact bytes it sent; once `express.json()` has parsed and re-serialised the body those bytes are gone and the signature can never match.

Idempotency is enforced by the query, not by a read-then-write: `findOneAndUpdate({ _id, paymentStatus: { $ne: 'paid' } })`. Both the webhook and the client's verify call can arrive, in either order, and Paystack retries.

Tested: unsigned → 401, forged signature → 401, valid → paid with `paymentMethod: momo` and `expiresAt` cleared, exact replay ignored, and a signed event claiming GH 1.00 against a GH 3,006 order rejected as underpayment.

**Robustness fix during testing.** The webhook originally looked the order up by `paystackReference` alone, which is only set by `initiatePayment`. If that save had failed, a real payment would have been orphaned. Since the reference *is* the order number, the lookup now falls back to `orderNumber` and then to `metadata.orderId`.

**Built: Cloudinary upload.** Multer `memoryStorage` (the file is going straight to Cloudinary, so writing it to disk first is a temp file for nothing), 5MB and 5-file limits, mime allowlist, and resize-on-upload since most users are on mobile data. The upload folder is built from the merchant's own shop id read server-side — a client-supplied folder would let one merchant write into another's.

**Built: `Review` model, controller and routes.** Three gates before a review is accepted: your order, that shop was in it, and that shop's sub-order is `completed`. A unique index on `{ order, shop }` makes duplicates a database error, not a race. `Shop.averageRating` and `reviewCount` are recalculated on every write and delete — the cost of denormalising them.

Tested: refused before completion, accepted after, duplicate rejected as 409, rating summary updated to 5 from 1 review, reviewer's user id absent from the public list, merchant reply saved.

**Built: `PriceAlert` model, controller and routes.** Upsert on `{ customer, product }` so re-setting a target updates the existing alert. Refuses a target at or above the current price.

**Built: BullMQ layer.** `jobs/queue.js` (lazy connection, `maxRetriesPerRequest: null` as BullMQ requires), `jobs/handlers.js`, `jobs/worker.js` as a separate process (`npm run worker`) with `upsertJobScheduler` for the repeatable sweeps.

The whole queue layer no-ops without `REDIS_URL` — `enqueue` returns false and warns, the API runs normally. Confirmed the worker exits with a clear message rather than a stack trace.

**Bug found that only exists in the worker process.** `runCheckPriceAlerts` populates `customer`, but `handlers.js` never imported the `User` model. The API happens to import it via `authMiddleware`, so it works there; the worker is a separate process and threw "Schema hasn't been registered for model User". Fixed with a side-effect import and a comment saying why.

All five handlers tested directly: featured expiry, shop-name sync (3 stale product copies repaired), price alert (fires once, then deactivates, re-run matches 0), weekly report aggregation.

**BullMQ scheduling itself is NOT tested.** No Redis available locally and no Upstash credentials yet. The handlers are proven and the worker imports cleanly, but the queue round-trip, the retry behaviour and the cron schedules have never actually run.

**Bugs found and fixed in previously "tested" code:**

| Bug | Effect |
| --- | --- |
| `sortOptions.distance` was `{ distance: -1 }` | `sort=distance` returned the **furthest** products first — the default sort on the main search |
| `getMyProducts` used `.toSorted({ createdAt: -1 })` | `Array.prototype.toSorted` takes a compare function, not a sort object. The endpoint threw every time it was called |
| `getProductById` returned 400 for a missing product | Should be 404 |
| `getProductById` populated `offersDelivery deliveryFee` | Fields being removed; now `deliveryRange` |
| `deleteProduct` read `shop._id` with no null check | 500 instead of 404 for a merchant with no shop |
| `registerUser` trusted `role` from the body | Anyone could self-register as an admin |

**Removed `offersDelivery` and `deliveryFee` from the Shop model.** Session 13 recorded that `deliveryRange` replaced `offersDelivery`, but both were still on the schema — leaving a merchant-editable `deliveryFee` field, directly contradicting the platform-sets-pricing rule.

**Added the subscription limit check to `createProduct`.** Architecture called it "a single check in createProduct" and it was absent. Reads the limit from settings, and treats an expired paid tier as free. Tested: free limit lowered to 2, third product rejected with the upgrade message, allowed after an admin upgrade to growth.

**Added `PATCH /api/shops/my-shop`** with an allowlist that deliberately excludes `status`, `isFeatured`, `subscriptionTier` and `verifiedAt`. A rename queues the shop-name sync job.

**Added `middleware/errorMiddleware.js`** — `notFound` plus an error handler that turns a bad ObjectId into 400, a validation error into 400 and a duplicate key into 409 instead of the 500 they were all producing.

**Fixed the port fallback.** `app.js` said `process.env.PORT || 5000` while every doc and `.env` said 4000.

**Added `.env.example`** and the `start`, `worker`, `worker:dev` and `seed:admin` scripts.

**Test data left in Atlas.** The end-to-end runs created real documents in the `shoptrace` database — roughly a dozen users on `@t.com` / `@test.com` addresses, six shops, a handful of products, six orders (`ST-00001` to `ST-00006`), one review and one price alert. Worth clearing before real data goes in.

---

## Session 17 — Postman collection, and two systemic bugs it exposed

Built a full Postman collection so the API can be tested by hand before the mobile app starts, then ran it with `newman` — which is what turned up the bugs below.

**Built: `server/postman/`** — collection, environment and a README. 172 requests across 16 folders, 255 assertions. Real Ghanaian test data throughout: Osu and Madina in Accra, Adum in Kumasi, an Infinix Hot 40i at GH₵ 1,450.50, Ghacem cement, MTN and Vodafone number prefixes.

Test scripts capture every token and id into environment variables, so no request needs an id pasted by hand. Folders run in dependency order, because the order is real — a product cannot be listed until a shop is verified, and a merchant cannot see an order until it is paid.

The signed-webhook requests build their body in a pre-request script and sign it with `CryptoJS.HmacSHA512`, storing the result in a variable that the request body then references. That means what gets signed is byte-for-byte what gets sent — and it works with no Paystack account at all.

**Verified: 172/172 requests, 255/255 assertions, twice in a row.** The second run proves it is re-runnable; `runId` keeps emails unique.

**Bug found and fixed: every Mongoose validation error was a 500.**

A three-character password returned `500 Server error` instead of "Password must be at least 6 characters long". A bad category enum, a negative price — all 500s. The cause: every controller wraps its work in its own `try/catch` and answered with a 500, so a `ValidationError` never reached the `errorHandler` written to classify it.

Fixed with `utils/apiError.js` — `classifyError` decides what an error means, and `sendError` is what controllers now call in their catch blocks. `errorMiddleware` uses the same `classifyError`, so one failure gets one status code wherever it surfaces. 42 catch blocks across 8 controllers were converted.

This one mattered more than it looks: the mobile app would have had nothing useful to show a user who typed a short password.

**Bug found and fixed: a malformed id was a 500 that leaked Mongoose internals.**

`GET /api/products/not-a-real-id` returned `500 Cast to ObjectId failed for value "not-a-real-id" (type string) at path "_id" for model "Product"`. Same root cause — the controller caught the `CastError` itself.

Fixed with `middleware/validateObjectId.js`, applied to all 19 routes carrying an id parameter. It rejects a bad id with a clean 400 *before* the controller runs, which also saves a pointless database round trip. Note this means the claim in session 16 that the error middleware handled bad ids was wrong in practice — it was never reached.

**Also added:** an explicit rating range check in `createReview`, so a rating of 9 returns a 400 naming the range rather than relying on schema validation.

**Bugs in the collection itself, found by running it:**

- Every request 404'd at first. The URL was an object with a `path` array but no `host`, so Newman rebuilt it and dropped the host entirely — `http:///api/shops`. Fixed by using a plain URL string, which Postman parses on import and still populates the Params tab from.
- Every webhook returned 401 because the `x-paystack-signature` header was never attached — the pre-request script computed the signature but nothing sent it.
- Three assertions raced the webhook. It answers Paystack immediately and finishes the database write just after, which is deliberate. Clicking through by hand you would never notice; an automated run reads the order before the write lands. Those three requests now wait first, with a comment explaining why.
- One assertion expected `count: 0` for hidden pending shops, which failed because earlier test runs had left verified shops near those coordinates. Now asserted per-shop rather than on the total.

**Test data note.** Each full run creates 6 users, 3 shops, 4-5 products, 3 orders, a review and a price alert. Re-running is safe but the data accumulates.

---

## Session 18 — Mobile app, all 16 screens

Built the Expo app end to end against `server/design.md`. No server calls yet — this is the design phase, and everything renders from mock data.

**Scope.** The spec lists 20 screens; 16 belong on a phone. Screens 17-20 are the admin web dashboard and were left out. Two screens were added that are not in the numbered inventory: an **OTP** screen, because there is no SMS provider yet, and a **Profile** screen, because the customer bottom nav has five items and Profile is one of them. 18 screens in total, across 23 route files.

**Stack.** Expo SDK 57, React Native 0.86, React 19.2, TypeScript, and **Expo Router** for file-based navigation — the folder tree under `src/app/` is the navigation graph, so there is no route config to keep in sync.

Routes live in `src/app`, not `app/` at the project root. Expo's CLI checks for `src/app` first and uses it automatically when present, so this needs no configuration, and it keeps the project root from carrying two source folders side by side.

**Built: `src/theme/index.ts`.** Every colour, type size, radius and spacing value from the spec, in one file. No screen writes a hex value. Two details worth noting: `borderWidth.hairline` uses `StyleSheet.hairlineWidth` rather than a literal `0.5`, because on Android 0.5 can round to zero and the border vanishes entirely; and `NO_SHADOW` is exported as a named constant so the no-shadows rule is visible in the code rather than merely absent from it.

**Built: `src/lib/format.ts`.** The section 21 copy rules. `cedis()` only shows decimals when the amount actually has pesewas, so a price of 890 reads `GH₵ 890` and not `GH₵ 890.00`. `distance()` never renders metres. `deliveryEstimate()` only ever returns a range.

**Built: the component layer** — `ui.tsx` (button, chip, field, toggle, pills, empty state), `cards.tsx` (product card, shop card, the `from GH₵ 890` treatment, the price-drop treatment), `headers.tsx` (the two-surface rule).

The `from` label at 10px in text-tertiary is the single most important detail in the card: it is what tells a customer that several prices exist and a comparison is available, which is the entire product.

**The two-surface rule is enforced by component choice.** `CreamHeader` for customer screens, `InkHeader` for merchant screens. Chips needed an `onSurface` prop because the merchant filter chips sit directly on ink, where a white outline chip would be invisible.

**Built: `src/lib/session.tsx`** — auth state, role, and the in-app notification queue.

**The OTP is delivered as an in-app notification**, because no SMS provider exists. `requestOtp` generates a six-digit code, stores it, and pushes it through a banner that slides down over whatever screen is showing. The banner is an ink card, so it reads as system chrome rather than page content.

When a provider is connected, only two things change: `requestOtp` calls the server, and the banner stops carrying the code. The OTP screen itself does not change.

**Built: `src/mocks/data.ts`**, shaped to match the API's real responses — `shopName`, `stockCount`, `imageUrls`, `subOrders`, `deliveryRange`. Swapping a mock for a `fetch` should be a change of source, not a change of shape. Data is real for Accra: MallTech Osu, Circle Electronics, Madina Provisions, Tema Hardware Hub, Adum Traders in Kumasi; an Infinix Hot 40i at GH₵ 1,450.50, Ghacem cement, a Binatone fan.

Crucially, `merchantOrders` is shaped as the merchant actually receives it — no `subOrders` array, no `grandTotal` — mirroring the privacy boundary the server enforces. The mock cannot leak another shop's items because the data simply is not there.

**Screens where the spec's reasoning drove the implementation:**

- **Search** groups results under "Near you" and "Elsewhere in Accra", with anything past the city band collapsed behind one line reading "N more shops nationwide from GH₵ X". Hiding a large saving would defeat the app.
- **Product detail** deliberately ignores that tier grouping and lists every shop sorted by price, because comparison is the page's whole purpose.
- **Shop profile** gives Call and WhatsApp the same visual weight as Order.
- **Checkout** groups line items by shop, each group with its own delivery line, because delivery is priced per shop on the server. Mobile Money is first and selected by default.
- **Order tracking** draws one timeline per shop, since sub-orders progress independently.
- **Price alerts** uses a progress bar between the price when the alert was set and the target, with "GH₵ 300 away" beside it.
- **Merchant orders** only offers status transitions the server's state machine would actually accept, so a merchant cannot tap a button and get a 400 back.
- **Shop settings** offers exactly three named delivery ranges and no fee field anywhere.
- **Add product** puts image upload above every text field.

**Surface switching.** There is no second account to register during the design phase, so Profile carries a "Switch to merchant" action and Shop settings carries the reverse. It also makes the two-surface rule easy to see back to back.

**Problems hit during setup:**

- `@expo/vector-icons` is no longer bundled with Expo in SDK 57 and had to be installed explicitly.
- Installing it failed on a peer conflict: `react-dom@19.3.0` had been hoisted while React is pinned at 19.2.3. Fixed by pinning `react-dom` to match rather than forcing the install with `--legacy-peer-deps`, which would have left a genuinely mismatched tree.
- The blank template ships no `babel.config.js`, so adding one referencing `babel-preset-expo` broke the bundler — that package is not a direct dependency by default. Installing it fixed the build. The config is needed anyway for `react-native-worklets/plugin`, which Reanimated 4 requires.

**Verified.** `npx tsc --noEmit` passes clean across all 23 route files and the component layer. `npx expo export --platform ios` completes with exit 0, producing a 4.1MB Hermes bundle with no warnings and all 23 routes registered.

**Not verified.** The app has never been opened on a simulator or a device in this session, so nothing has been seen rendering. Bundling proves every import resolves and the types line up; it does not prove a layout looks right.

---

## Session 19 — The app talks to the server

Wired the mobile app to the real API, and added the three server pieces that were missing for a full end-to-end run: saved addresses, saved payment methods, and a way to pay without Paystack.

**Server: `POST /api/payments/mock-pay/:orderId`.** Marks an order paid with no payment provider involved, so the whole lifecycle can be walked today. Three things keep it safe: it refuses unless `ALLOW_MOCK_PAYMENTS=true`, it refuses outright when `NODE_ENV=production`, and it goes through the **same `markOrderPaid` helper the real webhook uses** — so testing with it exercises the real idempotency path rather than a parallel one that could drift. The reference it writes is prefixed `MOCK-`, so a fake payment can never be mistaken for a Paystack one in the database.

**Server: saved addresses and payment methods** on the User model, with CRUD under `/api/auth/me/addresses` and `/api/auth/me/payment-methods`, plus `PATCH /api/auth/me` for name and phone. None of these paths take a `:userId` — a user can only ever edit themselves.

Addresses store GeoJSON `[longitude, latitude]`, the same shape Shop uses, so checkout hands the coordinates straight to the delivery calculator with no conversion.

**Payment methods are Mobile Money only, and that is a decision rather than an omission.** A MoMo number is not a secret the way a card number is — it is the same number a customer reads out to a merchant on the phone. Storing a card number would put the project in PCI scope; the correct approach keeps a Paystack authorization token instead of the card, which needs Paystack. So the option does not exist rather than existing in an unsafe form.

**Mobile: `src/lib/api.ts`.** One client. It works out the base URL rather than hardcoding it, because that is the most common thing to get wrong in Expo: the iOS simulator reaches the Mac on `localhost`, the Android emulator needs `10.0.2.2`, and a real phone needs the Mac's LAN IP — which Expo already knows, because that is how it served the bundle. It reads that back off the dev-server host. `EXPO_PUBLIC_API_URL` overrides everything.

It also surfaces the server's own error messages. The API was built to return usable ones — "Password must be at least 6 characters long" — and throwing them away for a generic string would waste that work.

**Mobile: `src/lib/cart.tsx`.** The cart did not exist before. It lives entirely on the device, because the server has no cart concept — an order is created in one shot with stock reserved atomically at that moment. So the cart is a local intention, not a reservation: an item can sell out between adding it and paying, and the server answers with a 409 naming the item. Built that way deliberately rather than faking a hold.

**Mobile: session rewritten.** Real register and login, JWT persisted to AsyncStorage so a reload does not sign you out, and the token handed to the api client on every change.

The OTP stays local. The server's auth is email plus password and there is no SMS provider, so the code is generated on the device and shown in the notification banner. It gates the phone-signup flow in the UI without pretending the server verified anything.

**Mobile: `useAsync` with refetch-on-focus.** This is what makes the merchant-to-customer loop visible: a customer watching an order sees the merchant's status changes simply by coming back to the screen. Real-time push is the upgrade.

**Screens now on the real API:** login, register, home, product detail, cart, checkout, order tracking, my orders, price alerts, profile, delivery addresses, payment methods, merchant orders.

**Still on mock data:** search, shop profile, merchant home, listings, analytics, shop settings, add/edit product.

**Verified end to end against Atlas — 34 assertions, all passing.** Register, save an address with correct `[lng, lat]` order, save a MoMo number, refuse a duplicate, refuse a card provider, list a product, find it in search, set a price alert, refuse a target above the current price, check out with stock going 10 to 8, confirm the merchant cannot see an unpaid order, pay without Paystack, refuse a second payment, confirm the merchant queue exposes one sub-order and no basket total, walk all four status changes with the customer seeing each one, refuse an illegal transition, and watch a price drop beat an alert target.

`npx tsc --noEmit` is clean and `expo export --platform ios` completes with exit 0.

**An environment note worth recording.** Partway through this session every DNS lookup from the shell began timing out, including to 8.8.8.8, which broke `mongodb+srv://` — it needs both an SRV and a TXT record. Since `connectDB` calls `process.exit(1)` on failure, the server died on boot rather than degrading. It cleared on its own. If it recurs, Atlas's non-SRV connection string avoids both lookups.

---

## Session 20 — Mocks deleted, merchant onboarding gate

Every screen now reads and writes the real server. `src/mocks/` is gone.

**Server: `GET /api/merchant/summary?days=N`.** Revenue, orders, views, a per-day series, top products and a funnel, all computed from real paid orders with an aggregation. The `$unwind` then `$match` on the merchant's own shop is what makes a multi-shop order contribute only its own slice.

Two deliberate choices in that endpoint. **Revenue counts completed sub-orders only**, with everything still in flight reported separately as `pipelineValue` — an accepted order is not money yet. And **the funnel is three steps, not five**: clicks and add-to-cart are not tracked anywhere, so inventing them would make the chart lie. It returns product views, orders, completed.

**Mobile: the merchant onboarding gate.** A merchant account on its own is not enough to sell. `src/lib/shop.tsx` loads the merchant's shop and resolves one of four states — none, pending, verified, suspended — and the merchant tab layout redirects anything but verified to `/merchant/setup`.

That screen is the shop registration form when there is no shop, and a waiting screen when the shop is pending, explaining exactly what is blocked and why. It also prints the admin call needed to verify it, since there is no admin app yet.

This mirrors the server rather than inventing a rule: `createProduct` returns 403 until the shop is verified, and `getNearbyShops` filters on status so a pending shop is invisible to customers. The gate just means a merchant learns that on a screen that explains it, instead of from a 403 after filling in a whole product form.

**Screens moved off mocks:** merchant home, listings, add/edit product, analytics, shop settings, customer search, shop profile. Plus the new setup screen.

**`src/lib/viewModels.ts`** replaces the types the cards used to borrow from the mock file. The cards render a view model rather than an API type, because a product card needs "from GH 890" and "4 shops nearby" — properties of a comparison, not of one product row. `adapt.ts` is the only place that builds them, and it documents the honest gap: the search endpoint returns one row per product per shop, so `shopCount` is 1 until there is an endpoint that groups by product.

**Verified end to end — 26 assertions, all passing.** Register a merchant, confirm no shop gives a 404 and a product is refused, register the shop, confirm it starts pending, confirm a pending shop cannot list products and is hidden from customer search, verify it as admin, confirm it becomes visible, list a product, edit the price and confirm price history was written, load the summary with a real product count and plan limit, place and pay an order as a customer, confirm revenue waits for completion while pipeline value shows it, then complete it and confirm revenue lands, top products populate, and the funnel carries only tracked steps.

`tsc --noEmit` clean, `expo export --platform ios` exit 0.

---

## Session 21 — Compare prices, auto-accept, and making stock trustworthy

**Compare prices across shops is back**, and it needed a new endpoint. Each shop creates its own Product document, so "Infinix Hot 40i" at three shops was three unrelated rows with nothing linking them. `GET /api/products/:id/compare` matches on a normalised name and returns every verified shop selling it, cheapest first, each with its own price, stock, distance and reliability.

Honest compromise, documented in the controller: name matching works when merchants type the same thing and fails when they do not. The real fix is a catalogue that shops attach offers to, which is a migration rather than an endpoint. Worth doing before launch.

**Orders now accept themselves on payment.** `markOrderPaid` flips every pending sub-order to `accepted` in the same atomic write. The acceptance step was really a stock check in disguise, and making a merchant confirm every success to catch the rare failure is the wrong trade when a shop takes dozens of orders a day.

So the escape hatch moved to where it belongs: `declined` is now reachable from `accepted` and `packed`, surfaced as one button - **Can't fulfil**. It refunds, returns the stock, and takes the merchant at their word by zeroing the count.

### The stale stock problem, and what was built for it

The problem Godbeck raised: a merchant lists 5, sells 2 over the counter, forgets to update here, and customers keep seeing 5.

The framing that unlocked it: **a stock figure is not a fact, it is a claim with an age.** It is rarely wrong because it is a number; it is wrong because it is old.

**`Product.stockConfirmedAt` records when the MERCHANT last vouched for the count** - deliberately not when the system last changed it. A platform sale decrements stock accurately and therefore proves nothing about counter sales, so automatic decrements do not refresh it. Only creating a product, editing its stock, or confirming it does. That distinction is the whole mechanism and it is tested.

**Confidence decays and the wording follows it.** Under a day: "5 in stock". Within a week: "About 5 left". Beyond that the number disappears entirely and the app says "Check availability" - because repeating a three-week-old figure reads as a promise the platform cannot keep.

**`Shop.fulfilledCount` and `declinedCount`** move on real outcomes, incremented with `$inc` for the same reason `viewCount` is. `fulfilmentRate` returns **null** below three outcomes rather than 100%: a new shop has not earned a perfect score, it simply has no score, and the interface says so.

**A shop with a poor record gets flagged even when its stock is fresh.** `needsConfirmation` is true when the claim is stale OR the shop fulfils under 70%, and the product screen then shows a plain sentence explaining which, with the button reading "Add anyway" instead of "Add to cart".

**`PATCH /api/products/:id/confirm-stock`** is the cheap half of the fix, and `/stock-check` is the screen around it: every product not vouched for in a week, each with minus / plus / "Still right", plus a confirm-all. The expensive half - failing an order and refunding someone - is a terrible way to discover a count was wrong.

**Verified.** 13 unit assertions on the confidence and reliability logic, and 22 API assertions covering: creation stamps confirmation, a sale does not refresh it, a price edit does not but a stock edit does, one-tap confirm with and without a new count, negatives refused, another merchant refused, no rate until there is history then 50% from 2 kept and 2 declined, compare carrying confidence and rate, a fresh-stock listing still flagged because the shop is unreliable, and an out-of-stock decline both zeroing and re-vouching.

### Also in this pass

Cart moved into the product-detail header. Profile left the tab bar, since it is reachable from the header avatar. The bell now opens a real **Notifications** screen assembled from order status history and beaten price alerts - useful before a notifications API exists, and shaped so it can swap source later. Tab bars sit higher off the bottom edge, and the body gutter went 14 to 18 because cards read as tight to the edge on a real phone.

Sixteen pieces of developer-facing copy were replaced with customer-facing wording - Paystack, Cloudinary, `.env` and the admin verify call are no longer mentioned anywhere a user can read.

**One bug worth recording.** `/merchant/setup` lived inside the merchant tabs folder, and the tab layout returned `<Redirect>` instead of `<Tabs>` when the shop was not verified. A layout that renders no navigator has nothing for its children to mount into, so the route it redirected to could not render and it looped. Moving setup to `/merchant-setup`, a sibling rather than a child, fixed the crash and removed the tab bar from the waiting screen at the same time.

---

## Current state

**Server — working and tested** (172 Postman requests, 255 assertions, all passing):

- Auth with role escalation closed, shops and geospatial search, product CRUD and search, price history, subscription limits
- Settings API, admin API, checkout with proven rollback, order state machine, merchant privacy boundary, expiry sweep
- Paystack signed webhook with idempotency and underpayment rejection
- Reviews gated on a completed sub-order, price alerts, all five job handlers
- Validation and cast errors return 400 with usable messages

**Mobile — built and bundling, not yet seen running:**

- All 16 mobile screens from the design spec, plus OTP and Profile
- Full design system in code; two-surface rule enforced by component choice
- Mock data shaped like the real API responses
- OTP delivered through an in-app notification banner until an SMS provider exists
- `tsc --noEmit` clean; `expo export` succeeds with no warnings

**Written but never actually run:**

- BullMQ queue round-trip, retries and cron schedules — no `REDIS_URL` yet
- Cloudinary uploads — no credentials; routes return 503
- Paystack `initiatePayment` / `verifyPayment` / `refundOrder` against the live sandbox
- The mobile app on a simulator or device

**Not started:**

- Admin dashboard (Next.js, screens 17-20)
- `packages/shared`
- Wiring the mobile app to the API
- Push notifications, email

**Immediate next steps:**

1. Open the app on a device or simulator and walk all 18 screens
2. Connect the mobile app to the API, starting with auth — the server is stable and documented
3. Upstash Redis, so the worker and expiry sweep actually run
4. Cloudinary credentials, then real product images
5. A Paystack test key plus a tunnel, then one sandbox Mobile Money payment end to end
6. Clear the accumulated test data out of Atlas
