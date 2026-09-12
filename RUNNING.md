# Running ShopTrace locally

Two terminals. The app is useless without the API, so start the API first.

## Terminal 1 — the API

```bash
cd server
npm run dev            # nodemon src/app.js, port 4000
```

Confirm it is alive before touching the app:

```bash
curl http://localhost:4000/health
```

## Terminal 2 — the app on the iOS Simulator

```bash
cd mobile
npm run ios            # = expo start --ios: boots the simulator, opens Expo Go
```

Or `npm run start` and then press **i** in that terminal. Same thing.

| key in the Metro terminal | does |
| --- | --- |
| `i` | open iOS Simulator |
| `a` | open Android emulator |
| `w` | open web at localhost:8081 |
| `r` | reload the app |
| `shift` + `i` | pick which simulator |

Saving a file hot-reloads automatically. You only need `r` when hot reload gets stuck.

## The database

The seeded merchants all share the password `merchant123`:

- osuelectronics@shoptrace.com
- circletech@shoptrace.com
- adumhardware@shoptrace.com
- kantamantostyles@shoptrace.com
- temahome@shoptrace.com

```bash
cd server
npm run db:reset       # wipes everything
npm run seed:merchants # 5 merchants, 5 shops, 15 products
npm run seed:admin     # an admin you can verify shops with
```

## If something breaks

**Port 4000 already in use** — another project is squatting on it:

```bash
lsof -ti:4000 | xargs kill -9
```

**App loads but every screen is empty** — the API is down, or the phone cannot
reach it. On the simulator the base URL is `localhost`; on a real phone it is
your Mac's LAN IP, which `lib/api.ts` reads from Expo's `hostUri`. The Mac and
the phone must be on the same Wi-Fi.

**Metro serving stale code:**

```bash
npx expo start --clear
```

**Simulator is wedged** — Device ▸ Erase All Content and Settings, or:

```bash
xcrun simctl shutdown all && xcrun simctl erase all
```
