/**
 * Turns API responses into the shapes the card components render.
 *
 * The server's product search returns ONE row per product per shop, so the
 * same phone in three shops arrives as three rows. Showing those raw would put
 * three identical cards on the home screen, each claiming "1 shop nearby" -
 * which is the opposite of what this app is for. `groupByProduct` folds them
 * into one card using the SAME rule the server's compare endpoint uses to
 * match products: trimmed name, case-insensitive. Matching on the same key in
 * both places is what stops a card saying "3 shops" and the compare screen
 * then showing two.
 */
import type { ApiProduct, ApiShop } from "./api";
import type { CardProduct, CardShop } from "./viewModels";

/** Haversine, matching the server's own distance helper. */
export const metresBetween = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

export const toCardProduct = (p: ApiProduct): CardProduct => ({
  _id: p._id,
  name: p.name,
  brand: p.brand,
  category: p.category,
  fromPrice: p.price,
  shopCount: 1,
  inStock: p.inStock,
  isFeatured: p.isFeatured,
  // $geoNear writes `distance` in metres onto each search result.
  distanceMeters: Math.round(p.distance ?? 0),
});

/**
 * The key two listings must share to count as the same product.
 *
 * Deliberately identical to the server's compareProduct matching, so a card
 * that promises three shops opens a comparison with three shops in it.
 */
const matchKey = (p: ApiProduct) => p.name.trim().toLowerCase();

/**
 * Folds one-row-per-shop listings into one card per product.
 *
 * The row kept as the card's identity is the CHEAPEST one, because the card
 * says "from GH₵ X" and tapping it should open the offer that price came
 * from. Ties go to the nearer shop.
 */
export const groupByProduct = (products: ApiProduct[]): CardProduct[] => {
  const groups = new Map<string, ApiProduct[]>();

  for (const product of products) {
    const key = matchKey(product);
    const existing = groups.get(key);
    if (existing) existing.push(product);
    else groups.set(key, [product]);
  }

  return [...groups.values()].map((listings) => {
    const sorted = [...listings].sort(
      (a, b) => a.price - b.price || (a.distance ?? 0) - (b.distance ?? 0),
    );
    const cheapest = sorted[0];

    // Two listings from the same shop must not count twice - a shop can list
    // the same item more than once.
    const shops = new Set(
      listings.map((l) => (typeof l.shop === "string" ? l.shop : l.shop?._id)),
    );

    return {
      ...toCardProduct(cheapest),
      shopCount: shops.size,
      // The card shows how far the nearest shop is, not how far the cheapest
      // one is - "2km away" is about the trip, not the price.
      distanceMeters: Math.round(
        Math.min(...listings.map((l) => l.distance ?? 0)),
      ),
      // One shop having it is enough for the card to read as available.
      inStock: listings.some((l) => l.inStock),
      isFeatured: listings.some((l) => l.isFeatured),
    };
  });
};

export const toCardShop = (
  s: ApiShop,
  from: { latitude: number; longitude: number },
): CardShop => {
  const [longitude, latitude] = s.location?.coordinates ?? [0, 0];

  return {
    _id: s._id,
    name: s.name,
    // The card has room for one line, so several categories read as a list.
    category: (s.categories ?? []).join(" · ") || "Shop",
    categories: s.categories ?? [],
    area: s.address,
    // Nearby shop search uses $near, which does not write a distance field,
    // so it is computed here from the same coordinates.
    distanceMeters: metresBetween(from, { latitude, longitude }),
    averageRating: s.averageRating,
    reviewCount: s.reviewCount,
    status: s.status,
    isFeatured: s.isFeatured,
  };
};
