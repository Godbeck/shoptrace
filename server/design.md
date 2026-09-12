# ShopTrace — Design Specification

Hand this to a designer or design tool as the complete brief. Everything here is decided; nothing needs inventing.

---

## 1. What ShopTrace is

A product price comparison app for Ghana. Customers search for a product — a phone, a bag of rice, a generator — and see which shops near them stock it and at what price. Merchants list their products and receive orders. An admin verifies shops and moderates listings.

**Primary user job:** find out where to buy something nearby, and for how much.

**Platforms:**

- Customer and merchant experience → **mobile app** (React Native / Expo, iOS + Android)
- Admin experience → **web dashboard** (desktop, sidebar layout)

**Market context that shapes the design:** most users are on mid-range Android phones on mobile data in Ghana. Prices are in Ghana Cedis (GH₵). Mobile Money is the dominant payment method. Many purchases get confirmed over a phone call or WhatsApp even when discovered online, so call and WhatsApp actions need real prominence — they are not afterthoughts.

---

## 2. Colour palette

Two colours plus tints. The palette is deliberately narrow — warm cream and near-black. No gradients, no third accent hue.

| Token          | Hex       | Role                                                          |
| -------------- | --------- | ------------------------------------------------------------- |
| `cream`        | `#FDF0D5` | Primary brand colour. App headers, key surfaces, text on dark |
| `cream-deep`   | `#FAF5EC` | Page background behind cards                                  |
| `cream-tint`   | `#FDF6E8` | Image placeholders, avatar and icon wells                     |
| `ink`          | `#1A1A1A` | Primary text, buttons, active states, merchant/admin headers  |
| `white`        | `#FFFFFF` | Card surfaces                                                 |
| `border`       | `#E8DFC8` | All borders and dividers — a warm tan, never grey             |
| `border-light` | `#F0E8D8` | Dividers inside cards                                         |

**Text colours:**

| Token            | Hex       | Use                                           |
| ---------------- | --------- | --------------------------------------------- |
| `text-primary`   | `#1A1A1A` | Headings, prices, names                       |
| `text-secondary` | `#555555` | Body copy, secondary labels                   |
| `text-tertiary`  | `#999999` | Metadata, timestamps, distances               |
| `text-muted`     | `#BBBBBB` | Placeholder text, disabled, chart axis labels |

**Status colours** — used only inside status pills and inline alerts, never as surfaces:

| State                                         | Background | Text      |
| --------------------------------------------- | ---------- | --------- |
| Success / delivered / verified / in stock     | `#E8F5E9`  | `#2E7D32` |
| Warning / pending / low stock                 | `#FDF0D5`  | `#8B6914` |
| Info / processing                             | `#E3F2FD`  | `#1565C0` |
| Danger / cancelled / out of stock / suspended | `#FEECEC`  | `#C62828` |

**Critical rule on borders:** never use a grey border. Every border, divider, and outline uses the warm tan tokens above. This is the single detail that keeps the palette feeling handmade rather than templated. A grey `#E5E7EB` border against cream immediately looks wrong.

---

## 3. The two-surface rule

The app has two visually distinct zones. This is intentional and load-bearing — it tells users instantly which side of the marketplace they are on.

**Customer surface — cream header.** Header background `cream`, logo mark is an `ink` rounded square with a cream icon inside, header text and icons in `ink`. Feels warm, retail, approachable.

**Merchant and admin surface — ink header.** Header background `ink`, logo mark is a `cream` rounded square with an ink icon, header text and icons in `cream`. Feels like a tool, a back office.

Page bodies stay `cream-deep` with white cards in both cases. Only the header and nav chrome flip.

---

## 4. Typography

One sans-serif family throughout. No serif display face, no monospace.

| Role                | Size    | Weight | Notes                        |
| ------------------- | ------- | ------ | ---------------------------- |
| Page title (mobile) | 18px    | 500    | Screen headings              |
| Section header      | 15px    | 500    | "Trending near you"          |
| Card title          | 13px    | 500    | Product names, shop names    |
| Body                | 13px    | 400    | Descriptions                 |
| Price — hero        | 22px    | 500    | Product detail page price    |
| Price — card        | 13–14px | 500    | In product cards             |
| Metadata            | 10–11px | 400    | Distance, timestamps, counts |
| Button              | 12–14px | 500    |                              |
| Field label         | 11px    | 500    | Sentence case, not caps      |
| Stat value          | 20–22px | 500    | Dashboard numbers            |

Maximum weight anywhere is **500**. No 600, no 700, no bold. The palette carries the emphasis, not weight.

Sentence case everywhere. **No all-caps labels** — not for field labels, not for section eyebrows, not for table headers on mobile. The one permitted exception is small uppercase labels inside the admin web data tables, where scanning density genuinely benefits.

---

## 5. Shape, spacing, elevation

| Property                      | Value                                    |
| ----------------------------- | ---------------------------------------- |
| Card radius                   | 12px                                     |
| Large card / panel radius     | 14px                                     |
| Button radius                 | 8px (12px for full-width primary)        |
| Input radius                  | 10px                                     |
| Pill / chip radius            | 20px                                     |
| Icon well radius              | 8–10px                                   |
| Border width                  | 0.5px standard, 1.5px for selected state |
| Screen horizontal padding     | 20px (header), 14px (card gutters)       |
| Card internal padding         | 12–14px                                  |
| Gap between stacked cards     | 8px                                      |
| Gap in horizontal scroll rows | 10px                                     |

**No shadows anywhere.** Separation comes from the 0.5px tan border against the cream background. This is a firm rule — a soft grey drop shadow under every card is the tell that makes an interface look generated.

**Selected state** is expressed as a 1.5px `ink` border plus a white background, never as a coloured fill or a shadow.

---

## 6. Component patterns

**Product card (customer)**
White surface, 12px radius, 0.5px tan border. Image well on top at `cream-tint` with a large muted icon placeholder. Body below: product name (13px/500), then shop count in `text-tertiary` ("4 shops nearby"), then price row. A "Featured" pill sits top-left over the image in `ink`/`cream`. A bell icon for price alerts sits top-right in a white rounded square.

Price displays as `from GH₵ 890` with "from" in `text-tertiary` at 10px — this signals to the customer that multiple prices exist and comparison is available. This detail is central to the product's purpose.

**Price drop treatment**
New price in `ink` at normal weight, old price beside it in `text-muted` with a line through, then a percentage pill in `ink`/`cream` reading `-12%`. Never red or green — the drop is information, not an alarm.

**Status pill**
20px radius, 10px text at weight 500, 3px vertical / 9px horizontal padding. Uses the status colour pairs from section 2.

**Verified shop badge**
A check-circle icon at 11px in `ink` followed by the word "Verified" at 10px/500 in `ink`. Never a blue checkmark — that reads as a social network.

**Bottom navigation (customer)**
White surface, 0.5px tan top border, five items: Home, Search, Alerts, Orders, Profile. Icons 20px, labels 10px. Inactive is `text-muted`; active is `ink` with the label at weight 500. No pill background behind the active item, no colour fill.

**Bottom navigation (merchant)**
Same construction, different items: Home, Listings, Orders, Analytics, Settings.

**Auth screens carry no bottom navigation.** Login and Register are pre-authentication and must not show nav chrome.

**Progress stepper (checkout)**
Horizontal row of numbered circles joined by 1px lines. Completed steps are `ink` filled with a cream checkmark; the current step is `ink` filled with its number; upcoming steps are `border` filled with `text-tertiary` numbers. Connector lines are `ink` when passed, `border` when ahead.

**Timeline (order tracking)**
Vertical. Completed nodes are 32px `ink` circles with a cream check. The active node is a 32px cream circle with a 2px `ink` ring and an `ink` icon. Future nodes are `border-light` filled with a muted icon. Connector lines follow the same passed/ahead logic. Each entry has a title (13px/500), timestamp (11px `text-tertiary`), and a description line.

**Charts**
Bars and lines in `ink` for the highlighted or current series, `border` for everything else. Axis labels 9px in `text-muted`. No gridlines. No colour coding across categories — hierarchy is expressed by ink versus tan alone.

**Toggle switch**
38×22px. On: `ink` track, cream knob at right. Off: `border` track, white knob at left.

**Empty states**
Centred: a 32–36px icon in `border`, a 13–14px/500 title in `text-primary`, an 11–12px line in `text-tertiary` saying what to do next. Empty screens are an invitation to act, so the supporting line should name the action, not describe the emptiness.

---

## 7. Screen inventory

### Shared / pre-auth — mobile

**1. Login**
Cream hero: centred logo mark plus wordmark, "Welcome back" (20px/500), one supporting line. Body on `cream-deep`: email or phone field, password field with reveal icon, right-aligned "Forgot password?" link, full-width `ink` sign-in button. Divider reading "or continue with", then two half-width outline buttons — Google and Phone. Footer line: "Don't have an account? Sign up" with the link portion in `ink` underlined. No bottom nav.

**2. Register**
Back button top-left. Cream hero: "Create account" plus one supporting line. Body: role selector first — two equal-width cards, Customer and Merchant, each with an icon above a label; selected card is `ink` filled with cream contents. Then full name, email, phone number, password. Full-width `ink` "Create account" button. Footer switch link to sign in, then a small terms line in `text-muted`. No bottom nav.

Phone number is a required field, not optional — Ghanaian identity and Mobile Money both depend on it.

### Customer — mobile

**3. Home**
Cream header containing: logo mark and wordmark left, bell and profile icons right; a location row below reading "Delivering to **East Legon, Accra**" with a chevron, where the area name is `ink` and the rest is `text-tertiary`; then a white search field with a magnifier icon, placeholder "Search products, shops...", and an `ink` "Filter" button inside on the right.

Body sections in order:

- Horizontal scrolling category chips — All, Electronics, Fashion, Food, Home, Hardware. Active chip is `ink` filled.
- Merchant recruitment banner: `ink` card, cream heading "Are you a shop owner?", muted supporting line, cream "List free" button.
- "Trending near you" — horizontal scroll of product cards, with "See all" link at right of the section header.
- "Shops near you" — horizontal scroll of wider shop cards, each with an icon well, shop name, category and distance, and a verified badge.
- "Price drops today" — horizontal scroll of product cards using the price-drop treatment.

**4. Search results**
Header: back button, populated search field with a clear icon, `ink` filter button. Below: result count ("**38 products** found near you") on the left; on the right a grid/list view toggle and a sort control showing the current sort.

Filter chips row: active filters are `ink` filled and carry a small × to remove; inactive are white outline. Examples — Electronics, Within 5km, In stock, Verified shops, Price drop.

Results as a two-column grid of product cards, each with a full-width `ink` "Compare prices" button at the bottom of the card.

**Tiered results grouping.** Results are grouped under two plain-text section headers rather than mixed together:

- "Near you" — shops within roughly 8km
- "Elsewhere in Accra" — roughly 8–35km

Below both, a single tappable line: "3 more shops nationwide from GH₵ 810". Anything beyond the city band is collapsed behind that line and never expanded by default.

**5. Product detail**
This is the most important screen in the app — it is where the comparison actually happens.

Header: back, "Product detail", heart and share icons. Then a 200px image area at `cream-tint` with page dots at the bottom.

White info card: a category chip at `cream`, product name (17px/500), then the price row — "from" in `text-tertiary`, `GH₵ 890` at 22px/500, and "— GH₵ 960 across shops" in `text-muted`. A divider, then "Available at **4 shops** near you" with a store icon.

Price alert card: cream icon well with a bell, "Set a price alert" title, "Get notified when price drops below your target" supporting line, `ink` "Set alert" button.

Then "Compare prices across shops" — a stack of shop cards. The cheapest carries a 1.5px `ink` border and a "Best price" pill with a trophy icon. Each card shows shop avatar, name, distance, verified badge, price at 18px/500, and two buttons: outline "View shop" and `ink` "Order now".

Finally a price history card: seven vertical bars for the last seven days, today's bar in `ink` and the rest in `border`, day labels beneath.

This screen ignores the tier grouping used in search — every shop stocking the product appears here, sorted by price, because comparison is the page's entire purpose.

**6. Shop profile**
Cream header with back, share, and more icons. Shop hero: 60px logo well, shop name (18px/500), category and area, verified badge with an optional "Featured" pill beside it.

A four-up stat row in white cards: Products, Rating, Distance, Years on platform.

Action row: three buttons — outline "Call", outline "WhatsApp", `ink` "Order". The first two are equal in prominence to ordering; this is deliberate for the Ghanaian market.

Tabs: Products, Info, Reviews — active tab marked by a 2px `ink` underline segment.

Products tab shows a two-column grid of compact product cards with stock status. Below, a map block: a 100px map area with an `ink` circular pin, then a footer row with the area and distance on the left and an `ink` "Directions" button on the right. Then an info card listing opening hours (with an "Open now" line in the success green), phone, and delivery terms.

**7. Checkout**
Header: back, "Checkout". Four-step progress stepper: Cart, Delivery, Payment, Done.

Order summary card: each line item with a 48px image well, name, shop name, a quantity stepper (− / value / +), and line price at right. Items are grouped by shop when the cart spans several — each shop gets its own labelled group with its own delivery line, because delivery is calculated per shop.

Delivery method card: two option cards, Delivery and Pickup, each showing an icon, label, and price beneath; selected is `ink` filled. Then an address row with a map pin, the address, and a "Change" link.

Payment method card: three stacked rows, each with a coloured icon well, name, supporting line, and a radio on the right. **Mobile Money is first and selected by default** — MTN, Vodafone, AirtelTigo named in the supporting line. When selected, a phone number input appears directly beneath it with a `+233` prefix segment. Then Debit / credit card, then Bank transfer.

Price breakdown card: Subtotal, Delivery, Platform fee, then a divider and Total. When a free-delivery promotion applies, delivery shows the raw fee struck through with the discount as its own line — never a silently reduced number.

Sticky footer on white with a 0.5px top border: full-width `ink` button reading "Pay GH₵ 1,254.20" with a lock icon, and beneath it a centred "Secured by Paystack" line with a shield icon in `text-muted`.

**8. Order tracking**
Header: back, "Order tracking", order number at right in `text-tertiary`.

Status hero on cream, centred: a 64px `ink` rounded square with a status icon, status title (18px/500), one supporting line, and an estimate chip in a white pill — "Estimated arrival · 2:30 PM today".

Delivery estimates are always **ranges, never fixed promises** — "Delivery today", "Delivery in 1–2 days", "Delivery in 2–4 days" depending on distance band.

Then: the vertical timeline card; an items card listing each product with quantity and shop; a shop contact card with Call and WhatsApp buttons; and a payment summary card showing subtotal, delivery, platform fee, total paid, and the payment method used.

Footer: a full-width outline "Need help with this order?" button above the bottom nav.

When an order spans multiple shops, each shop gets its own timeline card with its own status — they progress independently.

**9. My orders**
Cream header with "My orders" and a search icon, then tabs: All, Active, Delivered, Cancelled.

Order cards each show: order number and timestamp top-left, status pill top-right, a row with the first item's image well, name, shop, and "+ 1 more item" if applicable, then a divider and a footer with the total on the left and a "Track order" or "View details" link on the right.

**10. Price alerts**
Cream header with "Price alerts" and a bell icon, then tabs: Active, Triggered.

Each alert card: product image well, name, shop count and category, then a price row reading `GH₵ 2,100 → Alert at GH₵ 1,800`, with a "Watching" or "Triggered" pill at the right.

Beneath, a 4px progress bar in `ink` on `border-light` showing how close the current price is to the target, with "GH₵ 1,800 target" on the left and "GH₵ 300 away" on the right in 9px `text-tertiary`. This bar is the distinctive element of the screen — it turns an abstract threshold into something glanceable.

A triggered alert replaces the bar with a success-green banner: a ringing-bell icon and "Price dropped to GH₵ 2,850 at MallTech Osu".

Footer of each card: when it was set on the left, a "Remove" link with a trash icon in the danger red on the right. Below the list, a full-width `ink` "Add new price alert" button.

### Merchant — mobile

All merchant screens use the **ink header**.

**11. Merchant home**
Ink header: shop avatar in a cream well, shop name in cream, a status line with a small green dot reading "Open · East Legon", bell and settings icons at right. Below, a period selector — Today, This week, This month — as pills, active pill cream-filled with ink text.

Body: a 2×2 stat grid — Revenue, Orders, Product views, Average order. Each card has a small uppercase-free label with a muted icon at the right, a 20px value, and a change line with a trend arrow in success green or danger red.

Then a revenue bar chart for the week with the peak day in `ink`.

Then "New orders (3)" — order cards showing customer avatar, name, timestamp and order number, a status pill, the item list as a single muted line, and a footer with the total and inline action buttons: outline "Decline" and `ink` "Accept". Later statuses swap these for "Details" and "Mark ready" / "Mark sent".

Then a "Quick actions" 2×2 grid: Add product, My listings, Get featured, Analytics — each a white card with a cream icon well, label, and a muted supporting line.

**12. My listings**
Ink header with "My listings", plus and search icons, and a search field on a translucent white surface. Filter chips row on ink: All (124), In stock, Low stock, Out of stock, Featured — active chip cream-filled.

A summary row: "**124 products** listed" with a sort control at right.

Product rows: 52px image well (with a small "Out" badge overlaid when out of stock), name, category, then a row with price and a stock pill. At the right, a view count with an eye icon above a small square edit button.

A floating `ink` "Add product" button sits above the bottom nav.

**13. Add / edit product**
Ink header: back, "Add product", cream "Save draft" button at right.

First block is image upload — a white card with a 1.5px dashed tan border, a camera icon, "Add product photos" and "Tap to upload · up to 5 images", with a row of 44px thumbnails and a dashed add-tile beneath. Images come first because they matter most to a listing.

Then grouped form sections, each a white card with a small section label on a cream strip:

- **Product details** — name, category (with chevron), brand, description
- **Pricing and stock** — price in GH₵, stock quantity, condition (with chevron)
- **Visibility** — two toggle rows: "In stock / Show as available to buyers", and "Featured listing / Boost visibility · GH₵ 15/week"

Full-width `ink` "Publish product" button at the bottom.

**14. Incoming orders**
Ink header with "Orders" and a search icon. Tabs on ink: New (with a cream count badge), Processing, Ready, Done.

Order cards: order number, timestamp and delivery method top-left, status pill top-right. Then a customer row with avatar, name, and phone number. Then an items block on a `cream-deep` surface listing each line with quantity and price. Then a delivery row — a map pin with the address and distance, or a store icon with "Customer will pick up in store". Then a divider, the total, and a three-button action row: danger-tinted "Decline", outline "Message", `ink` "Accept".

A merchant sees only their own portion of a multi-shop order. Other shops' items must never appear.

**15. Analytics**
Ink header with "Analytics" and a download icon, then a period selector: 7 days, 30 days, 3 months, All time.

Body:

- 2×2 stat grid — Total revenue, Total orders, Product views, Conversion rate
- Revenue line chart over the period: a `border`-coloured baseline path with an `ink` path over it and a filled dot at the latest point
- Orders by day-of-week bar chart, peak days in `ink`
- "Top products by revenue" — ranked rows with a rank number in `text-muted`, image well, name, a views-and-orders line, an 80px proportional bar, and revenue at right
- "Sales funnel" — four horizontal bars in `ink` on `border-light`, labelled Views, Clicks, Add cart, Orders, each with its count inside the bar and at the right edge

**16. Shop settings**
Ink header with back and "Shop settings". Shop hero on ink: 56px cream logo well with a small camera edit affordance at its corner, shop name in cream, area and category muted, a verified chip on a translucent surface.

Grouped setting sections, each row with a cream icon well, a label, a muted current-value line, and either a chevron or a toggle:

- **Shop info** — name, location, phone, opening hours, category
- **Delivery** — "Offer delivery" toggle, then a delivery range selector with exactly three options: My area (~8km), All of my city (~35km), Nationwide. Merchants choose from this fixed list only; they never type distances or fees. Delivery pricing is platform-controlled and not shown as editable here.
- **Notifications** — "New order alerts" toggle, "Weekly report" toggle
- **Account** — payout account (showing the MoMo number), change password

A danger-tinted full-width "Sign out" button at the bottom.

### Admin — web dashboard, desktop

Fixed 200px `ink` sidebar on the left, `#F7F3EC` content area on the right. Content padding 24px.

**Sidebar construction:** logo mark in a cream square, "ShopTrace" wordmark in cream, and a small "Admin" tag on a dark grey surface. Then grouped nav items with 16px icons and 12px labels. Inactive items are `#666`; the active item has a translucent cream background and a 2px cream left border with cream icon and label. Count badges are cream pills with ink text, right-aligned. A divider separates "Main" from "Platform". At the bottom, a user row with an avatar, name, and role above a hairline top border.

Nav items: Overview, Shop approvals (badge), All merchants — divider — All orders, Analytics, Flagged listings (badge), Settings.

**17. Overview**
Page header: "Platform overview" (18px/500) with the current date beneath in `text-tertiary`, and a period selector at the right — 7 days, 30 days, All time.

A four-up stat row: Total revenue, Active shops, Total orders, Platform fees. Each with a label, a muted icon at the right, a 22px value, and a trend line.

Then a two-column row: an "Orders this month" bar chart by week on the left, and a "Recent activity" feed on the right. Feed rows carry a small coloured dot (green approved, amber submitted, blue volume, red flagged), a sentence with the shop name in `text-primary`, and a relative timestamp at the right.

Then a full-width "Pending shop approvals" card containing a compact table: Shop name, Owner, Category, Location, Submitted, Status.

**18. Shop approvals**
Page header: "Shop approvals" with "8 shops pending review" beneath.

Filter bar: chips for All, Pending, Info needed, Recently approved, with a search field pushed to the right.

Each pending shop is a white card. The collapsed row is a five-column grid: shop (avatar, name, owner name and email), category, location, submitted date, and a status pill with a "Review" expander beneath it.

Expanding reveals an inline panel on a `#FDFAF4` surface — **not a new page**, so the admin never loses their place in the queue. It contains a three-column detail grid (phone, address, products listed, opening hours, payout account, registration date), then a row of document chips each with a check icon when supplied and a clock icon when still awaited, then three action buttons: `ink` "Approve shop", danger "Reject", outline "Request more info".

**19. All merchants**
Page header: "All merchants" with the total count beneath, and an outline "Export CSV" button at the right.

Toolbar: a search field, two dropdown filters (Category, Location), then status chips — All, Verified, Pending, Suspended.

A full data table with a `#FDFAF4` header row and 10px uppercase column labels — this is the one place uppercase labels are permitted, for scanning density. Columns: Shop (avatar, name with an optional "Featured" tag, owner beneath), Category, Location, Products, Revenue (30d), Orders (30d), Status, Actions.

Rows highlight to `#FDFAF4` on hover. Dormant shops show em dashes rather than zeros in the revenue and orders columns.

**Actions are context-aware:** a verified shop shows "View" and danger "Suspend"; a suspended shop shows "View" and success "Activate"; a pending shop shows "View" only. Never render an action that would be invalid for that row's state.

Footer: "Showing 1–6 of 342 merchants" on the left, numbered pagination on the right with the current page as an `ink` square.

**20. Platform settings**
Grouped setting cards for values the admin controls and merchants cannot:

- **Delivery pricing** — base fee, per-km rate, neighbourhood radius, city radius
- **Free delivery campaign** — an enabled toggle, minimum order value, maximum distance, maximum subsidy per shop, maximum subsidy per order, and a start/end date range
- **Fees** — platform fee percentage, featured listing weekly price
- **Subscription tiers** — product limit and monthly price for Free, Growth, and Pro
- **Orders** — unpaid order timeout in minutes

Every field is a labelled row with its current value and an inline edit affordance. The free delivery campaign block should read clearly as something switched on for a period and then off again, not a permanent setting.

---

## 21. Content and copy rules

Currency always renders as `GH₵ 1,254.20` — the symbol, a space, thousands separators, two decimals only when non-zero.

Distances read as `0.8km` under 10km and `16km` above. Never metres in the interface.

Delivery timing always uses ranges, never fixed hour counts.

Buttons name the action and keep the same word through the flow — a "Publish product" button produces a "Published" confirmation.

Errors state what happened and how to fix it, without apologising and without vagueness. "Free plan limit reached. Upgrade to add more products." not "Something went wrong."

Empty states name the next action rather than describing the emptiness.

---

## 22. Things to avoid

These would break the identity:

- Grey borders or grey dividers anywhere — always warm tan
- Drop shadows under cards
- Font weights above 500
- All-caps labels outside the admin data tables
- A third accent colour, or gradients
- Green or red as surface colours (they belong only in status pills)
- Blue verification checkmarks
- Coloured category coding in charts — ink and tan only
- Bottom navigation on Login or Register
- Fixed delivery time promises
- Merchant-editable delivery fees or radii in kilometres
- Showing a merchant any part of an order that isn't theirs
