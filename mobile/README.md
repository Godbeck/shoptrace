# ShopTrace mobile

Expo (React Native) app covering both the customer and merchant surfaces.
Every screen in `server/design.md` that belongs on a phone is built. Screens
17–20 are the admin web dashboard and are not here.

**Connected to the API.** There is no mock data anywhere — every screen reads and writes the real server.

## Running it

```bash
cd mobile
npm install
npm start
```

Then press `i` for the iOS simulator, `a` for Android, or scan the QR code with
Expo Go on your phone.

## Where things are

```
mobile/
└── src/
    ├── app/                  Expo Router - the file tree IS the navigation
    │   ├── _layout.tsx       providers + the notification banner
    │   ├── index.tsx         decides: auth, customer, or merchant
    │   ├── auth/             login, register, otp
    │   ├── customer/         5 tabs: home, search, alerts, orders, profile
    │   ├── merchant/         5 tabs: home, listings, orders, analytics, settings
    │   ├── product/[id].tsx  product detail
    │   ├── shop/[id].tsx     shop profile
    │   ├── order/[id].tsx    order tracking
    │   ├── checkout.tsx
    │   └── product-form.tsx  add / edit product
    ├── theme/                every colour, size and radius
    ├── components/           ui, cards, headers, notification banner
    └── lib/                  api client, session, cart, shop, formatters
```

**Why `src/app` and not `app/` at the root?** Both work. Expo's CLI checks for
`src/app` first and uses it automatically if present, logging *"Using src/app
as the root directory for Expo Router"* — so there is no config to set. Keeping
everything under one `src/` is tidier than a project root with two source
folders side by side.

## The two rules worth knowing before you edit anything

**1. Never write a hex value in a screen.** Everything comes from
`src/theme/index.ts`. If a value is missing, add it there first. That file is
what stops the identity drifting one screen at a time.

**2. Customer = cream header. Merchant = ink header.** Use `CreamHeader` /
`InkHeader` from `src/components/headers.tsx` and never mix them. Page bodies
stay cream-deep on both sides — only the chrome flips.

Beyond that: no shadows anywhere, no font weight above 500, all borders are
warm tan and never grey, and status colours live only inside pills.

## Screens, mapped to the spec

| # | Spec screen | Route |
| --- | --- | --- |
| 1 | Login | `/auth/login` |
| 2 | Register | `/auth/register` |
| — | OTP verification | `/auth/otp` |
| 3 | Home | `/customer` |
| 4 | Search results | `/customer/search` |
| 5 | Product detail | `/product/[id]` |
| 6 | Shop profile | `/shop/[id]` |
| 7 | Checkout | `/checkout` |
| 8 | Order tracking | `/order/[id]` |
| 9 | My orders | `/customer/orders` |
| 10 | Price alerts | `/customer/alerts` |
| — | Profile | `/customer/profile` |
| 11 | Merchant home | `/merchant` |
| 12 | My listings | `/merchant/listings` |
| 13 | Add / edit product | `/product-form` |
| 14 | Incoming orders | `/merchant/orders` |
| 15 | Analytics | `/merchant/analytics` |
| 16 | Shop settings | `/merchant/settings` |

Two screens are not in the numbered spec. **OTP** exists because there is no
SMS provider yet. **Profile** exists because the customer bottom nav has five
items and Profile is one of them.

## How to see the merchant side

There is no second account to register. Open **Profile → Switch to merchant**,
or **Shop settings → Switch to customer view** to come back.

## The OTP, and why it is on screen

No SMS provider is connected. So `requestOtp` in `src/lib/session.tsx`
generates a 6-digit code locally and pushes it through the in-app notification
banner, which slides down over whatever screen you are on.

Try it: **Login → Phone**, or register a new account.

When a real provider is wired up, two things change — `requestOtp` calls the
server, and the banner stops carrying the code. The OTP screen itself does not
change at all.

## Connecting the server later

`src/mocks/data.ts` is deliberately shaped like the API's real responses:
`shopName`, `stockCount`, `imageUrls`, `subOrders`, `deliveryRange` and so on
all match the Mongoose models. Swapping a mock for a `fetch` should be a change
of source, not a change of shape.

Screens never reach for mock data through a global — they import it directly,
so the places to change are easy to find with a single grep for `@/mocks/data`.

## What is deliberately stubbed

These tap through to a notification explaining why, rather than silently doing
nothing:

- Image upload (needs Cloudinary)
- Paying at checkout (needs Paystack)
- Maps, directions, address picker (needs a maps API)
- Google sign-in (needs OAuth keys)
- Password reset (needs an email provider)
