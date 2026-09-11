# CLAUDE.md

Guidance for Claude when working in the ShopTrace repository.

---

## What this project is

ShopTrace is a product price comparison platform for Ghana. Customers search for a product and see which nearby shops stock it and at what price. Merchants list products and fulfil orders. Admins verify shops and control platform settings.

Prices are in Ghana Cedis (GH₵). Mobile Money is the dominant payment method. Most users are on mid-range Android phones on mobile data.

Read `ARCHITECTURE.md` for the system design and `BUILD_LOG.md` for what has been built and decided so far.

---

## How to work with the developer on this project

This is a learning project. Godbeck is a full-stack engineer who is strong on frontend and learning backend through building this. The working relationship matters as much as the code.

**Teach, don't just deliver.** The goal is for him to understand the backend, not to have it written for him. Explain the concept, then let him write it.

**Use ShopTrace examples, never abstract ones.** Don't explain middleware with a generic `/api/users` example — explain it with "a merchant adds a phone, and middleware checks they own that shop first."

**Plain English. Define jargon or avoid it.** Say "middleware is code that runs between the request arriving and your controller executing" — not "middleware intercepts the request lifecycle."

**Keep teaching turns short — under about 400 words.** Long explanations don't land. One concept, one example, then the steps.

**The working pattern:**

1. Explain the concept with a ShopTrace example
2. Show a small version so it's visible
3. Give the exact steps to build the real thing
4. He builds it and pastes the code
5. Review it, then move on

**He is a visual learner.** Diagrams, tables, and small worked examples land better than paragraphs. Video resources over written docs when recommending learning material — Net Ninja for React Native, Traversy Media for backend.

**Be honest about weak choices.** If a pattern is a simplification, say so and name the upgrade path. He caught a real bug in a hook implementation and correctly pushed back on a delivery pricing default that would have lost money. Treat that as the norm, not an exception.

**Don't mark things as tested that he hasn't run.** Ask, or say what state it's actually in.

---

## Stack

| Layer    | Technology                                |
| -------- | ----------------------------------------- |
| Mobile   | Expo (React Native) — customer + merchant |
| Admin    | Next.js — web dashboard, desktop only     |
| API      | Express, ES modules (`"type": "module"`)  |
| Database | MongoDB Atlas + Mongoose                  |
| Auth     | JWT + bcryptjs, self-issued               |
| Jobs     | BullMQ + Upstash Redis                    |
| Payments | Paystack                                  |
| Images   | Cloudinary                                |

---

## Repository structure

```
shoptrace/
├── mobile/          Expo React Native (not started)
├── admin/           Next.js admin dashboard (not started)
├── server/          Express API (in progress)
│   └── src/
│       ├── config/      db.js
│       ├── models/      Mongoose schemas
│       ├── controllers/ Route logic
│       ├── routes/      URL definitions
│       ├── middleware/  authMiddleware.js
│       ├── utils/       Helpers
│       ├── jobs/        BullMQ workers (empty)
│       └── app.js
└── packages/
    └── shared/      Types, API client, formatters (not started)
```

The API runs on **port 4000**, not 5000.

---

## Code conventions

**ES modules with explicit `.js` extensions on imports.** Node requires the extension. `import User from '../models/User.js'` — omitting it is a common error here.

**Controllers are `export const`, one function per endpoint.** Every controller follows the same shape: check → do → respond.

**Routes are thin.** A route file is a readable list of endpoints with middleware chained before the controller. No logic.

**Route ordering: specific before parameterised.** `/nearby` and `/my-shop` must be declared above `/:id`, or Express matches them as an id. This has already caused a bug once.

**Mongoose hooks use `function`, not arrow functions.** Arrow functions don't bind `this`, so `this.password` is undefined.

**Money is rounded explicitly.** `Math.round(value * 100) / 100` on every calculated amount. Never leave a float like `72.50000000001` in a response or the database.

**Status codes are meaningful:** 201 created, 200 ok, 400 bad request, 401 identity unknown, 403 identity known but insufficient, 404 not found, 409 conflict (stock race), 500 server error.

**Controller catch blocks call `sendError(res, error, "fnName error:")`**, never a bare `res.status(500)`. A bare 500 turns a Mongoose `ValidationError` into "Server error" and the app has nothing to show the user — this was a real bug across 42 catch blocks. `classifyError` in `utils/apiError.js` is the single source of truth, shared with `errorMiddleware`.

**Routes with an id parameter chain `validateObjectId()`** before the controller. Because every controller catches its own errors, a `CastError` never reaches the error middleware — it came back as a 500 leaking `Cast to ObjectId failed for value ... for model Product`.

---

## Patterns that must be followed

These are established and load-bearing. Don't deviate without saying why.

**Identity always comes from the server, never the request body.** Shop ownership, product location, customer details on an order — all read from `req.user` or the associated shop. A merchant cannot send a `shopId`.

**Ownership checks are separate from role checks.** `authorize('merchant')` confirms someone is a merchant, not that they own this specific product. Every update and delete additionally compares the resource's shop against the requester's shop.

**Compare ObjectIds with `.toString()`.** `product.shop !== shop._id` is always true. Direct comparison of ObjectId instances never matches.

**Updates use an `allowedFields` allowlist.** Never spread `req.body` onto a document — a merchant could send `isFeatured: true` or an inflated `viewCount`.

**Use `.save()`, not `findByIdAndUpdate`, when hooks matter.** `findByIdAndUpdate` bypasses document middleware, which would silently skip price history and the `inStock` derivation on products.

**Counters use `$inc`, never read-modify-write.** Two concurrent views both reading 10 and both writing 11 loses a view.

**Stock changes are atomic and conditional.** Use `reserveStock` / `releaseStock` from `utils/stock.js`, never a hand-written update:

```js
Product.findOneAndUpdate(
  { _id: id, stockCount: { $gte: qty }, isActive: true },
  [
    { $set: { stockCount: { $subtract: ['$stockCount', qty] } } },
    { $set: { inStock: { $gt: ['$stockCount', 0] } } },
  ],
  { new: true, updatePipeline: true },
);
```

A null result means another request won the race. It is a pipeline update rather than `$inc` because `findOneAndUpdate` bypasses the `pre('save')` hook that derives `inStock`, so a plain `$inc` would leave `inStock: true` on a product that just hit zero. Mongoose 9 needs `updatePipeline: true` or it throws.

**GeoJSON coordinates are `[longitude, latitude]`.** Clients send `latitude` and `longitude` as named fields; the server flips them. Getting this wrong puts Accra shops in the Indian Ocean.

**`$geoNear` must be the first aggregation stage.** MongoDB enforces it. This also means `$text` can't be combined with geo search — location-based product search uses `$regex` instead, and the text index is reserved for a future global search endpoint.

**Products are soft-deleted via `isActive`.** Orders reference products, so hard deletion breaks order history. Every customer-facing query filters on the flag.

**Order items are snapshots, not references.** An `OrderItem` stores its own copy of name, brand, price, and image. The `product` ObjectId is kept only for linking back. An order must display correctly a year later regardless of what happened to the product.

**Identity and role never come from the request body.** Registration accepts only `customer` and `merchant`; `admin` is granted by an existing admin or by `npm run seed:admin`. This was a real hole — `role: 'admin'` in a register body used to work.

**Money that reaches a payment provider is recomputed from the database.** `initiatePayment` reads `order.grandTotal`; an amount in the request body is ignored. Paystack works in pesewas, so every amount goes through `toPesewas`.

**Payment writes are idempotent through the query.** `findOneAndUpdate({ _id, paymentStatus: { $ne: 'paid' } })`, never read-then-write. The webhook and the client's verify call both arrive, in either order, and Paystack retries.

**The Paystack webhook needs the raw body.** It is mounted in `app.js` above `express.json()` with `express.raw()`. Once the body is parsed and re-serialised the signature can never match.

**Job enqueues must never break the request.** Use `enqueueQuietly` from `jobs/queue.js` in hooks and controllers. The whole queue layer no-ops without `REDIS_URL`.

**A model used only inside a job still has to be imported by `jobs/handlers.js`.** The worker is a separate process, so nothing else registers the schema. This bit once, on `.populate('customer')`.

**Platform config lives in the `settings` singleton, not in code constants.** Delivery pricing, fee percentages, subscription limits, order timeout. Changing pricing is an admin action, not a deploy. Access it via `Settings.get()`.

**Merchants never set delivery fees or distances.** They get one three-option range selector (`area` / `city` / `nationwide`) that maps to platform-defined kilometre values via `getRangeMaxDistance`. There is deliberately no `deliveryFee` field on the Shop model.

**Order numbers come from `Counter.next('orderNumber')`**, an atomic `$inc`. Never `countDocuments() + 1`.

**A merchant sees only their own sub-order.** Multi-shop orders mean other shops' items are in the same document. `getShopOrders` reshapes the response to strip them. This is a privacy boundary.

---

## Gotchas already hit

**The MongoDB connection string needs the database name** between the `/` and the `?`, or documents silently land in a database called `test`.

**`pre('save')` cannot read the old value of a modified field.** By then `this.price` already holds the new value. The Product model captures the old price in `post('init')` — before anything mutates it — and reads it back in `pre('save')`.

**`post('init')` does not fire on `.aggregate()`.** Aggregation returns plain objects, not Mongoose documents.

**Mongoose hooks with zero arguments don't need `next()`.** Declaring `next` and forgetting to call it hangs the request forever.

**Only one text index per collection.** Choose the fields before committing; changing them later means dropping and recreating.

---

## Design system

Full spec is in the design specification document. The essentials:

**Two colours.** Cream `#FDF0D5` and near-black `#1A1A1A`.

**Warm tan borders, never grey.** `#E8DFC8` for borders, `#F0E8D8` for dividers inside cards. A grey border against cream immediately looks wrong. This is the detail that keeps the identity intact.

**No shadows.** Separation comes from a 0.5px tan border on white cards against a cream background.

**Maximum font weight 500.** No bold anywhere.

**Sentence case.** No all-caps labels, except column headers in admin data tables.

**Two surfaces.** Customer screens use a cream header; merchant and admin screens use an ink header. Page bodies stay cream in both cases — only the chrome flips.

**Status colours only inside pills**, never as surfaces. Green success, amber pending, blue processing, red danger.

**Delivery estimates are ranges**, never fixed promises. "Delivery in 1–2 days", not "48hrs".

---

## Testing

`server/postman/` holds a collection of 172 requests and 255 assertions covering every route, with real test data filled in and tokens captured automatically. Run the folders in order — the order is a dependency chain. See `server/postman/README.md`.

Verified with `npx newman run` — 172/172 requests, 255/255 assertions, twice in a row.

## Current state

The server is feature-complete and covered by the Postman collection. See `BUILD_LOG.md` sessions 16 and 17.

**Working and tested:** auth with role escalation closed, shops and geospatial search, product CRUD and search and price history, subscription limits, settings API, admin API, checkout with proven rollback, order state machine, merchant privacy boundary, expiry sweep, Paystack webhook with signature verification and idempotency, reviews gated on completion, price alerts, all five job handlers, and 400-with-a-real-message on validation and cast errors.

**Written but never actually run:**

- BullMQ queue round-trip, retries and cron schedules — no `REDIS_URL` yet
- Cloudinary uploads — no credentials; the routes return 503
- Paystack `initiatePayment` / `verifyPayment` / `refundOrder` against the live sandbox

**Not started:** mobile app, admin dashboard, `packages/shared`, push notifications, email.

**Immediate next steps:**

1. Upstash Redis, confirm the worker connects and the sweep fires
2. Cloudinary credentials, upload one real image
3. Real Paystack test key, one sandbox MoMo payment with the webhook on a tunnel
4. Clear the accumulated test data out of Atlas
5. Start the mobile app

## Known simplifications

Named honestly so they aren't mistaken for oversights. Full table in `ARCHITECTURE.md`.

**Checkout rollback is manual compensation, not a transaction.** A `reservations` array accumulates successful stock reservations and releases them on failure. Readable, and chosen deliberately for learning — but a process crash between reservation and rollback leaves stock stuck. MongoDB sessions are the upgrade, and Atlas M0 supports them.

**Distance is Haversine straight-line**, which under-estimates road distance by roughly 30% in a city.

**Pagination uses `$skip`**, which degrades at high page counts.

**Payment splitting is deferred.** A single payment record sits on the parent order; Paystack subaccounts come later.
