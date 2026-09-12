# ShopTrace

A product price comparison marketplace for Ghana. A customer searches for a
product and sees which nearby shops stock it, at what price, and how far away
they are. Merchants list products and fulfil orders. Admins verify shops.

Prices are in Ghana Cedis (GH₵). Distances come from real coordinates, so the
app only makes sense with a location.

---

## Running it

Two terminals. The app is useless without the API, so start the API first.

### 1. The API

```bash
cd server
npm install          # first time only
npm run dev          # nodemon src/app.js, port 4000
```

Check it is alive before touching the app:

```bash
curl http://localhost:4000/health
# {"status":"ok","uptime":...}
```

### 2. The app

```bash
cd mobile
npm install          # first time only
npm run ios          # iOS simulator
npm run android      # Android emulator
npm run web          # browser at localhost:8081
```

Or `npm start` and pick a platform from the keyboard:

| key | does |
| --- | --- |
| `i` | open iOS Simulator |
| `a` | open Android emulator |
| `w` | open web |
| `r` | reload the app |
| `shift` + `i` | choose which simulator |

Saving a file hot-reloads. You only need `r` when hot reload gets stuck.

**On a real phone:** install Expo Go, run `npm start`, scan the QR code. The
phone and the Mac must be on the same Wi-Fi — `mobile/src/lib/api.ts` reads
your LAN IP from Expo's `hostUri`, because `localhost` on a phone means the
phone.

---

## Environment

`server/.env` — copy `server/.env.example` and fill it in. Only four keys are
needed to run everything:

| key | note |
| --- | --- |
| `PORT` | 4000 |
| `MONGO_URI` | the database name must sit between the `/` and the `?`, or documents land in a database called `test` |
| `JWT_SECRET` | any long random string |
| `ALLOW_MOCK_PAYMENTS` | lets an order complete without Paystack; refused outright when `NODE_ENV=production` |

The rest (Redis, Paystack, Cloudinary) are optional. Without them the queue
no-ops, payments go through the mock endpoint, and image upload returns 503.

The mobile app needs no configuration — it finds the API on its own.

---

## The database

```bash
cd server
npm run db:reset          # wipe everything
npm run seed:merchants    # 5 merchants, 5 shops, 15 products
npm run seed:admin        # an admin, for verifying shops
```

Seeded merchants — all share the password **`merchant123`**:

| email | shop | categories |
| --- | --- | --- |
| `osuelectronics@shoptrace.com` | Osu Electronics Centre | Electronics |
| `circletech@shoptrace.com` | Circle Tech Plaza | Electronics · Home |
| `adumhardware@shoptrace.com` | Adum Hardware Depot | Hardware |
| `kantamantostyles@shoptrace.com` | Kantamanto Styles | Fashion |
| `temahome@shoptrace.com` | Tema Home & Living | Home · Hardware |

Four products are stocked by two shops each, so the price comparison has
something real to compare. Customers you register yourself.

**A merchant must be verified before they can use the merchant app.** A newly
registered shop sits on a waiting screen until an admin approves it:

```bash
PATCH /api/admin/shops/<shopId>/verify
```

`seed:merchants` creates its shops already verified, so you only need this for
merchants you register by hand.

---

## Layout

```
shoptrace/
├── server/       Express API, MongoDB Atlas — port 4000
├── mobile/       Expo app, customer + merchant surfaces
└── admin/        Next.js dashboard (not started)
```

| doc | what it holds |
| --- | --- |
| `ARCHITECTURE.md` | system design, data model, and the known simplifications |
| `BUILD_LOG.md` | what was built each session, and why |
| `Claude.md` | conventions and load-bearing patterns |
| `mobile/README.md` | screen map, design rules, mobile-specific notes |
| `server/postman/README.md` | the API test collection |

---

## Testing the API

`server/postman/` holds a collection covering every route, with test data
filled in and tokens captured automatically. Run the folders in order — the
order is a dependency chain.

```bash
cd server/postman
npx newman run ShopTrace.postman_collection.json \
  -e ShopTrace.postman_environment.json
```

---

## Two accounts, or one?

One. A merchant and a customer are the same account — Profile ▸ **Switch to
merchant** flips the app between the two surfaces, and `role` never changes.
The man who owns a hardware shop still buys shirts.

The one thing he cannot do is buy from **his own** shop. Checkout refuses it
with a 403, because `fulfilmentRate` is hidden below three outcomes, so three
orders placed with yourself would publish a 100% fulfilment rate to real
customers.

---

## When something breaks

**Port 4000 already in use** — another project is squatting on it:

```bash
lsof -ti:4000 | xargs kill -9
```

**Every screen is empty** — the API is down, or the phone cannot reach it.
Check `curl http://localhost:4000/health` first.

**Metro serving stale code:**

```bash
npx expo start --clear
```

**`git add` fails with "does not have a commit checked out"** — a nested
`.git` from a scaffolding tool. Find it with
`find . -name .git -not -path "./.git"` and delete it.

**Simulator wedged:**

```bash
xcrun simctl shutdown all && xcrun simctl erase all
```
