# ShopTrace — Architecture

A product price comparison platform for Ghana. Customers search for a product and see which nearby shops stock it and at what price. Merchants list products and fulfil orders. Admins verify shops and control platform settings.

---

## 1. System shape

Three deployable pieces plus a shared package, in one monorepo.

```
shoptrace/
├── mobile/          Expo React Native — customer + merchant (iOS, Android)
├── admin/           Next.js — admin dashboard (web only)
├── server/          Express REST API
└── packages/
    └── shared/      Types, API client helpers, constants
```

The mobile app and admin dashboard are both clients. Neither touches the database. Everything goes through the Express API.

```
┌─────────────────┐     ┌─────────────────┐
│  Mobile (Expo)  │     │ Admin (Next.js) │
│  customer +     │     │  web dashboard  │
│  merchant       │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │  HTTPS + JWT
              ┌──────▼───────┐
              │  Express API │
              │  (Railway)   │
              └──────┬───────┘
                     │
      ┌──────────────┼──────────────┬──────────────┐
      │              │              │              │
┌─────▼─────┐  ┌─────▼─────┐  ┌────▼─────┐  ┌─────▼──────┐
│  MongoDB  │  │  Upstash  │  │ Paystack │  │ Cloudinary │
│  Atlas    │  │  Redis    │  │          │  │            │
│  (data)   │  │ (BullMQ)  │  │(payments)│  │  (images)  │
└───────────┘  └───────────┘  └──────────┘  └────────────┘
```

### Why the API is separate from Next.js

The API is a standalone Express server rather than Next.js API routes. This means one backend serves both the mobile app and the admin dashboard, and the mobile app is never coupled to a web framework. It also makes the backend independently deployable and testable.

### Why React Native for mobile and Next.js for admin

React Native Web could technically render the admin dashboard, but the admin is built from desktop UI patterns — a fixed sidebar, dense data tables, multi-column grids, inline expanding rows. Fighting React Native Web to produce those costs more effort than writing three Next.js pages. The admin is also internal, so it needs to work well rather than feel native.

Shared logic — request types, the API client, currency and distance formatters, status enums — lives in `packages/shared` and is imported by both clients.

---

## 2. Stack

| Layer         | Technology               | Notes                                                        |
| ------------- | ------------------------ | ------------------------------------------------------------ |
| Mobile        | Expo (React Native)      | Customer and merchant surfaces                               |
| Admin         | Next.js                  | Web only, desktop layout                                     |
| API           | Express (ES modules)     | `"type": "module"` in package.json                           |
| Database      | MongoDB Atlas + Mongoose | Free M0 tier is a replica set, so transactions are available |
| Auth          | JWT + bcryptjs           | Self-issued tokens, no third-party auth service              |
| Jobs          | BullMQ + Upstash Redis   | Background and scheduled work                                |
| Payments      | Paystack                 | Mobile Money, card, bank transfer                            |
| Images        | Cloudinary               | Product and shop photos                                      |
| Mobile deploy | Expo EAS                 |                                                              |
| Admin deploy  | Vercel                   |                                                              |
| API deploy    | Railway                  | API process + worker process                                 |

---

## 3. Server layout

```
server/
├── src/
│   ├── config/
│   │   └── db.js                  Mongoose connection
│   ├── models/
│   │   ├── User.js
│   │   ├── Shop.js
│   │   ├── Product.js
│   │   ├── PriceHistory.js
│   │   ├── Order.js
│   │   └── Settings.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── shopController.js
│   │   ├── productController.js
│   │   └── orderController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── shopRoutes.js
│   │   ├── productRoutes.js
│   │   └── orderRoutes.js
│   ├── middleware/
│   │   └── authMiddleware.js       protect, authorize
│   ├── utils/
│   │   ├── generateToken.js
│   │   ├── generateOrderNumber.js
│   │   └── deliveryCalculator.js
│   ├── jobs/                       BullMQ workers (not yet built)
│   └── app.js
├── .env                            never committed
└── package.json
```

**Request flow:** `app.js` mounts routers at path prefixes → a route matches a method and path → middleware runs in order → the controller executes → the model talks to MongoDB.

**Route ordering rule:** specific paths must be declared above parameterised ones. `/nearby` and `/my-shop` come before `/:id`, otherwise Express matches them as an id.

---

## 4. Data model

### Collections

| Collection       | Purpose                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `users`          | Customers, merchants, admins — one collection, differentiated by `role`  |
| `shops`          | One shop per merchant, with GeoJSON location                             |
| `products`       | Belongs to a shop, carries a denormalised copy of shop name and location |
| `pricehistories` | Append-only log of every price change                                    |
| `orders`         | Contains nested sub-orders, one per shop                                 |
| `settings`       | Singleton document holding platform configuration                        |

### Relationships

```
User ──1:1── Shop ──1:N── Product ──1:N── PriceHistory
 │                            │
 │                            │ (snapshot copy)
 └──1:N── Order ──1:N── SubOrder ──1:N── OrderItem
                  │
                  └── references Shop
```

`User` to `Shop` is one-to-one, enforced in `createShop` by checking for an existing shop owned by the requester.

`Order` contains an array of `SubOrder` subdocuments. Each sub-order belongs to one shop and has its own status, delivery method, fee, and status history. `OrderItem` is nested inside a sub-order with `{ _id: false }` since items are never queried individually.

### Indexes

| Collection       | Index                                                  | Serves                                   |
| ---------------- | ------------------------------------------------------ | ---------------------------------------- |
| `shops`          | `{ location: '2dsphere' }`                             | Nearby shop search                       |
| `shops`          | `{ status: 1, category: 1 }`                           | Filtered browse                          |
| `shops`          | `{ averageRating: -1 }`                                | Sort by rating                           |
| `products`       | `{ location: '2dsphere' }`                             | Nearby product search                    |
| `products`       | `{ name: 'text', brand: 'text', description: 'text' }` | Text search (one per collection maximum) |
| `products`       | `{ shop: 1, isActive: 1 }`                             | Merchant's own listings                  |
| `products`       | `{ category: 1, price: 1 }`                            | Category browse with price sort          |
| `pricehistories` | `{ product: 1, createdAt: -1 }`                        | Product price chart                      |
| `orders`         | `{ customer: 1, createdAt: -1 }`                       | Customer order history                   |
| `orders`         | `{ 'subOrders.shop': 1, 'subOrders.status': 1 }`       | Merchant order queue                     |
| `orders`         | `{ paymentStatus: 1, expiresAt: 1 }`                   | Expiry sweep job                         |

Each index mirrors a query the application actually runs. None are speculative.

---

## 5. Key design decisions

### Denormalisation

Three places store deliberate duplicate data:

**`Product.shopName` and `Product.location`** — copied from the parent shop. This lets a single geospatial aggregation run directly on products, without a join MongoDB cannot efficiently perform. Trade-off: a shop rename leaves stale names on existing products until a sync job updates them.

**`Shop.averageRating` and `Shop.reviewCount`** — computed summaries rather than an embedded review array. Reviews will live in their own collection. A search results page showing 50 shops needs 50 ratings; recalculating on read would require 50 aggregations.

**`OrderItem` name, brand, price, and image** — a frozen snapshot at purchase time, not a live reference. This is the most important one. An order is a historical record: it must show what the customer actually paid even if the product is later renamed, repriced, or soft-deleted. The `product` ObjectId is retained only for linking back.

### Soft deletes

Products carry `isActive` rather than being removed. Orders reference products, so a hard delete would leave order history with missing data. `deleteProduct` sets the flag; every customer-facing query filters on it.

### Atomic stock reservation

Stock is never read-then-written. That pattern loses inventory under concurrency: two simultaneous orders both read `stockCount: 1`, both pass the check, both write `0`, and two units are sold.

Instead the condition is part of the write:

```js
Product.findOneAndUpdate(
  { _id: id, stockCount: { $gte: qty }, isActive: true },
  { $inc: { stockCount: -qty } },
  { new: true },
);
```

A null result means another request won the race, and nothing was written.

The same principle applies to `viewCount`, which uses `$inc` so concurrent views cannot overwrite each other.

### Rollback on partial checkout failure

A multi-item order reserves stock item by item. If item three fails, items one and two have already been decremented. Every successful reservation is pushed to a `reservations` array declared outside the `try` block; on any failure — including an unexpected throw caught by `catch` — `releaseStock` increments everything back.

This is manual compensation rather than a MongoDB transaction. It is readable and sufficient at current scale, but it has a real gap: a process crash between reservation and rollback leaves stock stuck. Converting to a session-based transaction is a known upgrade path, and Atlas M0 supports it.

### Order state machine

Sub-order status transitions are constrained by an explicit map:

```
pending          → accepted, declined
accepted         → packed, cancelled
packed           → out_for_delivery, ready_for_pickup, cancelled
out_for_delivery → completed
ready_for_pickup → completed
completed        → (terminal)
```

Without this a merchant could jump `pending` straight to `completed`, skipping acceptance and packing, or mark a declined order as delivered. Any transition not listed is rejected with a 400.

Declining or cancelling returns stock to every item in that sub-order.

### Multi-shop orders

One order, many sub-orders. The customer pays once; each shop fulfils independently with its own status and its own delivery.

Consequences:

- Delivery fee is calculated per shop from real distance
- Merchant order queries reshape the response so a merchant sees only their own sub-order — other shops' items are a privacy boundary and must never leak
- The parent order's status is derived, not stored (see below)
- Payment splitting via Paystack subaccounts is deferred; a single payment record sits on the parent order for now

### Derived order status

`Order.overallStatus` is a Mongoose virtual computed from its sub-orders' statuses. `completed` only when all are complete; `cancelled` only when all are cancelled or declined; otherwise the most advanced in-progress state wins.

Virtuals are excluded from JSON by default, so the schema sets `toJSON: { virtuals: true }`.

### Platform-controlled configuration

Delivery pricing, platform fee percentage, subscription limits, featured listing price, and order timeout all live in a single `settings` document rather than in code constants. Changing pricing is an admin action, not a deploy.

`Settings.get()` is a static that lazily creates the document with defaults on first call, so there is no null-config failure mode on a fresh install.

Merchants get one delivery choice — a three-option range selector (`area`, `city`, `nationwide`) that maps to platform-defined kilometre values. They never set fees or distances directly.

### Text search limitation

MongoDB permits `$text` only in the first stage of an aggregation pipeline, and `$geoNear` must occupy that position. Location-based product search therefore uses a case-insensitive `$regex` on name. The text index remains for a future global search endpoint that does not filter by location. This is a genuine MongoDB constraint, documented here so it is not mistaken for an oversight.

### Price history via hooks

Price changes are recorded automatically, not by controller code.

- `post('init')` captures the price as loaded from the database into `$locals.persistedPrice`
- `pre('save')` detects `isModified('price')` and stashes the old value
- `post('save')` writes a `PriceHistory` document with both prices, then resets the baseline

The `post('init')` step is essential: by the time `pre('save')` runs, `this.price` already holds the new value, so the old price must be captured at load time.

Because these are document hooks, product updates must use `findById` then `.save()`. `findByIdAndUpdate` bypasses them, which would silently skip both price history and the `inStock` derivation.

### Delivery tiers

Distance drives both pricing and how results are grouped:

| Tier          | Range  | Estimate shown       |
| ------------- | ------ | -------------------- |
| Neighbourhood | 0–8km  | Delivery today       |
| City          | 8–35km | Delivery in 1–2 days |
| Regional      | 35km+  | Delivery in 2–4 days |

Estimates are ranges, never fixed hour promises, because fulfilment speed is not yet controlled or measured. Once real order timing data exists, per-shop measured averages can replace them.

Fee formula: `baseFee + (perKmRate × distanceKm)`, computed server-side and never accepted from the client. Distance uses the Haversine formula between shop and delivery coordinates — straight-line, which under-estimates road distance by roughly 30% in a city. Acceptable given the base fee absorbs some of that.

Search results are grouped under two visible bands (near you, elsewhere in the city) with anything beyond collapsed behind a single savings line. The product detail page ignores tiers entirely and lists every shop sorted by price, because comparison is that page's whole purpose.

### Free delivery as a campaign

Subsidised delivery is off by default with four guardrails: minimum order value, maximum distance, maximum subsidy per shop, and maximum subsidy per order. It also carries a start and end date so a promotion expires by itself.

The per-order cap matters for multi-shop baskets — without it, three shops at maximum subsidy each would triple the platform's cost on a single order. The checkout loop tracks subsidy consumed and reduces what later shops can claim.

Raw fee and subsidy are both stored on each sub-order, which allows the interface to show a struck-through original price and gives the platform an audit trail of promotion cost.

---

## 6. Authentication and authorisation

**Registration** hashes the password via a `pre('save')` hook on the User schema — controllers never hash manually. The hook guards on `isModified('password')` so profile updates do not double-hash and break login.

**Login** compares via `user.matchPassword()`, a schema method wrapping `bcrypt.compare`. Both failure cases — unknown email, wrong password — return the same message, so the API does not disclose which emails are registered.

**Token** is a JWT containing only the user id, signed with `JWT_SECRET`, expiring per `JWT_EXPIRE`.

**Two middleware layers:**

`protect` extracts the token from the `Authorization: Bearer <token>` header, verifies it, loads the user with `.select('-password')`, and attaches it as `req.user`. It also handles the case of a valid token for a since-deleted user.

`authorize(...roles)` is a factory returning middleware that checks `req.user.role` against an allowlist. Used as `authorize('merchant')` or `authorize('merchant', 'admin')`.

Status codes are distinguished: 401 means identity is unknown or invalid; 403 means identity is known but insufficient.

**Ownership checks are separate from role checks.** `authorize('merchant')` confirms someone is a merchant, not that they own a specific resource. Every update and delete additionally compares the resource's shop against the requester's shop, converting ObjectIds with `.toString()` since direct comparison of ObjectId instances always differs.

**Mass assignment protection.** Updates apply an explicit `allowedFields` allowlist rather than spreading `req.body`. Without it a merchant could send `isFeatured: true` or an inflated `viewCount`.

**Identity always comes from the server.** Shop ownership, product location, and customer details on an order are all read from `req.user` or the associated shop — never accepted from the request body.

---

## 7. API surface

Base path `/api`. All routes returning or mutating user-owned data require `protect`.

### Auth — `/api/auth`

| Method | Path        | Access    | Purpose                       |
| ------ | ----------- | --------- | ----------------------------- |
| POST   | `/register` | public    | Create account, returns token |
| POST   | `/login`    | public    | Authenticate, returns token   |
| GET    | `/me`       | protected | Current user profile          |

### Shops — `/api/shops`

| Method | Path       | Access   | Purpose                               |
| ------ | ---------- | -------- | ------------------------------------- |
| GET    | `/nearby`  | public   | Geospatial shop search, verified only |
| POST   | `/`        | merchant | Register a shop, starts as `pending`  |
| GET    | `/my-shop` | merchant | Own shop                              |
| GET    | `/:id`     | public   | Shop profile                          |

### Products — `/api/products`

| Method | Path                 | Access   | Purpose                                |
| ------ | -------------------- | -------- | -------------------------------------- |
| GET    | `/search`            | public   | Geo + text + filter + sort + paginate  |
| GET    | `/my-products`       | merchant | Own listings                           |
| POST   | `/`                  | merchant | Create listing, requires verified shop |
| GET    | `/:id/price-history` | public   | Last 30 price changes                  |
| GET    | `/:id`               | public   | Product detail, increments view count  |
| PATCH  | `/:id`               | merchant | Update own product                     |
| DELETE | `/:id`               | merchant | Soft delete own product                |

### Orders — `/api/orders`

| Method | Path           | Access    | Purpose                                                 |
| ------ | -------------- | --------- | ------------------------------------------------------- |
| POST   | `/`            | protected | Checkout — group by shop, reserve stock, calculate fees |
| GET    | `/my-orders`   | protected | Customer order history                                  |
| GET    | `/shop-orders` | merchant  | Paid orders for own shop only                           |
| GET    | `/:id`         | protected | Order detail, owner or admin                            |
| PATCH  | `/:id/status`  | merchant  | Advance own sub-order through state machine             |
| PATCH  | `/:id/cancel`  | protected | Customer cancels while still pending or accepted        |

### Search parameters

`/api/products/search` accepts: `search`, `latitude`, `longitude`, `radius`, `category`, `minPrice`, `maxPrice`, `inStockOnly`, `sort` (`distance` | `priceLow` | `priceHigh` | `newest`), `page`, `limit`.

Latitude and longitude are required. All query params arrive as strings and are parsed. The `sort` value is resolved through a lookup map with a safe fallback so user input never reaches a `$sort` operator directly.

---

## 8. Geospatial handling

**Coordinate order is `[longitude, latitude]]`.** GeoJSON requires longitude first, which is the reverse of how coordinates are usually written and displayed. Clients send `latitude` and `longitude` as named fields; the server flips them when building the GeoJSON object. Getting this wrong places Accra shops in the Indian Ocean.

**Shop and product both store a `Point`** with a `2dsphere` index. Products carry a copy of their shop's coordinates so product search does not require a join.

**Search uses `$geoNear` as the first aggregation stage** — mandatory position. It writes a `distance` field in metres onto each result, which the client displays directly, and it sorts nearest-first for free. `spherical: true` is required for `2dsphere` indexes.

**Checkout uses Haversine instead**, because there are two fixed points and no query to run.

**Pagination uses `$skip` / `$limit`**, which degrades at high page counts since MongoDB still walks skipped documents. Acceptable for a shopping search where nobody reaches page 500; cursor-based pagination is the upgrade if it ever matters.

---

## 9. Background jobs

BullMQ workers on Upstash Redis, deployed as a separate Railway process from the API. Not yet implemented; the schema fields they depend on already exist.

| Job                     | Trigger                 | Work                                                                      |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------- |
| Order expiry sweep      | Every minute            | Find `paymentStatus: 'unpaid'` past `expiresAt`, cancel and release stock |
| Featured listing expiry | Hourly                  | Find products past `featuredUntil`, set `isFeatured: false`               |
| Price alert check       | On product price change | Match against `PriceAlert` targets, notify                                |
| Weekly merchant report  | Monday cron             | Aggregate per-shop stats, send email digest                               |
| Shop name sync          | On shop rename          | Update denormalised `shopName` on that shop's products                    |

The order expiry job is the most important: without it, abandoned checkouts hold stock indefinitely. The `{ paymentStatus: 1, expiresAt: 1 }` index exists specifically for its query.

---

## 10. Monetisation model

Phased, so early friction stays low.

**Phase 1 — free.** `platformFeePercent` defaults to `0`. Priority is shop density; an empty marketplace has no value to anyone.

**Phase 2 — featured listings.** Merchants pay a weekly rate (default GH₵ 15, configurable in settings) for placement priority. Opt-in, immediately visible benefit, no commitment. Already present in the schema as `isFeatured` and `featuredUntil`.

**Phase 3 — tiered subscriptions.**

| Tier   | Product limit | Monthly |
| ------ | ------------- | ------- |
| Free   | 10            | GH₵ 0   |
| Growth | 500           | GH₵ 60  |
| Pro    | 5000          | GH₵ 150 |

Limits live in `settings.subscriptionTiers`, not on shop documents, so changing the free-tier allowance is one edit rather than a migration. The shop stores only `subscriptionTier` and `subscriptionExpiresAt`.

The upgrade funnel is a single check in `createProduct`: at the limit, return 403 with a message naming the upgrade.

**Transaction fee** stays available via `platformFeePercent` but is intended to be small and applied only to in-app payments. The rationale: ShopTrace's value is discovery, not payment processing. Many purchases will be discovered in-app and completed by phone call or in person, which commission cannot capture and should not try to police. Subscription charges for the value actually delivered.

---

## 11. Environment variables

```
PORT=4000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/shoptrace?retryWrites=true&w=majority
JWT_SECRET=<long random string>
JWT_EXPIRE=30d
```

Not yet added: `REDIS_URL`, `PAYSTACK_SECRET_KEY`, `CLOUDINARY_URL`, `RESEND_API_KEY`.

The database name must be present in the connection string, immediately before the `?`. Omitting it silently writes to a database called `test`.

`.env` is listed in `.gitignore` and must never be committed.

---

## 12. Known gaps and upgrade paths

| Area                     | Current state                                                | Upgrade                                                                       |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Checkout atomicity       | Manual compensation via `reservations` array                 | MongoDB session transaction                                                   |
| Order numbering          | `countDocuments() + 1`                                       | Dedicated counter collection — current approach can collide under concurrency |
| Price history durability | Written in `post('save')`, not atomic with the product write | Acceptable; history is non-financial                                          |
| Product search           | `$regex` on name only                                        | Global text-search endpoint using the existing text index                     |
| Distance accuracy        | Haversine straight-line                                      | Google Distance Matrix for road distance                                      |
| Pagination               | `$skip` / `$limit`                                           | Cursor-based                                                                  |
| Payment splitting        | Single payment on parent order                               | Paystack subaccounts per merchant                                             |
| Reviews                  | Rating fields exist, always `0`                              | Review model, gated on a completed order                                      |
| Delivery consolidation   | One fee per shop                                             | Shared delivery when shops are within ~2km of each other                      |
| Shop name staleness      | Denormalised copies drift on rename                          | Sync job                                                                      |
