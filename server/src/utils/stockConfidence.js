/**
 * How much to trust a stock number, based on how long ago a merchant last
 * confirmed it.
 *
 * The number is rarely wrong because it is a number. It is wrong because it
 * is OLD - the merchant sold two over the counter last Tuesday and never came
 * back here. So the app stops quoting a figure it cannot stand behind, and
 * says so instead.
 */

const DAY = 24 * 60 * 60 * 1000;

export const FRESH_MS = 1 * DAY;
export const AGING_MS = 7 * DAY;

/** "fresh" | "aging" | "stale" */
export const stockConfidence = (confirmedAt) => {
  if (!confirmedAt) return "stale";

  const age = Date.now() - new Date(confirmedAt).getTime();
  if (age <= FRESH_MS) return "fresh";
  if (age <= AGING_MS) return "aging";
  return "stale";
};

/**
 * How reliable a shop has been at actually delivering what it listed.
 *
 * Returns null rather than 100% for a shop with no history - a brand new shop
 * has not earned a perfect score, it simply has no score, and the interface
 * should say that rather than flatter it.
 */
export const fulfilmentRate = (shop) => {
  const fulfilled = shop?.fulfilledCount ?? 0;
  const declined = shop?.declinedCount ?? 0;
  const total = fulfilled + declined;

  if (total < 3) return null;
  return Math.round((fulfilled / total) * 100);
};

/**
 * Whether a customer should be told to check before paying.
 *
 * Either the stock claim has gone stale, or this shop has a track record of
 * not having what it listed.
 */
export const needsConfirmation = (product, shop) => {
  if (stockConfidence(product?.stockConfirmedAt) === "stale") return true;

  const rate = fulfilmentRate(shop);
  return rate !== null && rate < 70;
};
