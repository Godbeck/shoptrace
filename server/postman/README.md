# ShopTrace Postman collection

Every route on the API, with real test data already filled in. Tokens and ids
are captured automatically by test scripts, so you never copy-paste an id.

- **172 requests** across 16 folders
- **255 assertions** — every request checks its own status code, and the
  important ones check the response body too
- Verified end to end with `newman`: 172/172 requests, 255/255 assertions,
  twice in a row

## Files

| File | What it is |
| --- | --- |
| `ShopTrace.postman_collection.json` | The collection — import into Postman |
| `ShopTrace.postman_environment.json` | The environment — variables, tokens, ids |

## Setup

1. **Start the API**

   ```bash
   npm run dev
   ```

2. **Create the first admin.** Registration cannot grant the admin role any
   more, so this is the only way to get one:

   ```bash
   npm run seed:admin -- "ShopTrace Admin" admin@shoptrace.com 0244000000 admin12345
   ```

3. **Add a Paystack key to `server/.env`** and restart:

   ```
   PAYSTACK_SECRET_KEY=sk_test_local_only
   ```

   It does **not** have to be a real Paystack key for the webhook tests — the
   collection signs its own webhook bodies with whatever this value is. But it
   must match `paystackSecret` in the Postman environment, or every webhook
   request returns 500.

4. **Import both files** into Postman, then select the `ShopTrace Local`
   environment from the dropdown at the top right.

## How to run it

Run the folders **in order, top to bottom**. The order is a real dependency
chain — you cannot list a product until a shop is verified, and a merchant
cannot see an order until it is paid.

- **Run `00 · Start here` first.** It sets a fresh `runId` so every email in
  the run is unique. Without it, a second run fails on duplicate emails.
- **★ requests are the ones that prove something important.** Do not skip them.
- **✗ requests are meant to fail.** A red status is the pass condition, and
  each one asserts the exact code it should return.
- Open the **Test results** tab after each request — you get a pass/fail
  instead of having to read the JSON yourself.

## Running the whole thing at once

```bash
npx newman run ShopTrace.postman_collection.json \
  -e ShopTrace.postman_environment.json
```

Add `--env-var baseUrl=http://localhost:4100` to point at a different port.

## What each folder covers

| Folder | Requests | What it proves |
| --- | --- | --- |
| 00 · Start here | 2 | Server is up; sets `runId` |
| 01 · Auth | 15 | Registration, login, JWT, and that `role: admin` cannot be self-assigned |
| 02 · Shops | 10 | Registration, GeoJSON coordinate order, the allowlist on shop edits |
| 03 · Admin — verify | 9 | Approval gate, and real spherical distance at 5km vs 300km |
| 04 · Products | 18 | CRUD, geo search, sort direction, price history, mass-assignment protection |
| 05 · Settings | 10 | Nested dot-path allowlist, validation, public vs admin views |
| 06 · Orders | 14 | **Checkout, the rollback, multi-shop sub-orders, pickup fallback** |
| 07 · Payments | 13 | **Webhook signature, idempotency, underpayment rejection** |
| 08 · Orders — queue | 21 | **The state machine, and the merchant privacy boundary** |
| 09 · Reviews | 11 | The three gates, duplicate protection, rating recalculation |
| 10 · Price alerts | 8 | Upsert behaviour, and firing on a price drop |
| 11 · Admin — the rest | 19 | Suspension, roles, stats, the manual expiry sweep |
| 12 · Subscription limit | 5 | The upgrade funnel: 403 at the limit, success after upgrade |
| 13 · Uploads | 8 | Cloudinary, mime allowlist, folder-based ownership |
| 14 · Error handling | 4 | 404s, bad JSON, malformed ids |
| 15 · Cleanup | 5 | Soft delete, and rating recalculation on review delete |

## Things you cannot fully test yet

| Needs | What happens without it |
| --- | --- |
| `CLOUDINARY_URL` | Upload routes return a clean 503 — worth confirming |
| A real `sk_test_` Paystack key | `initiate` / `verify` / `refund` return 502. Signed webhooks still work |
| `REDIS_URL` (Upstash) | Job queueing returns 503. Use `POST /api/admin/jobs/expire-orders`, which runs the same code |

Uploads also need you to **attach files by hand** — Postman cannot store binary
files inside an exported collection.

## A note on test data

Every run creates real documents in your database: 6 users, 3 shops, 4-5
products, 3 orders, a review and a price alert. Re-running is safe (the `runId`
keeps emails unique) but the data accumulates. Clear the `shoptrace` database
before you start on anything real.
