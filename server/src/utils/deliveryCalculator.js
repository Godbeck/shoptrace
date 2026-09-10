import Settings from "../models/Settings.js";

const round = (value) => Math.round(value * 100) / 100;

/**
 * A merchant picks a word; the platform decides what that word means in
 * metres. This is the whole reason merchants never type a distance.
 *
 * 'none' returns 0, which means no distance can ever satisfy it - pickup only.
 */
export const getRangeMaxDistance = (deliveryRange, settings) => {
  switch (deliveryRange) {
    case "area":
      return settings.delivery.neighbourhoodRadius;
    case "city":
      return settings.delivery.cityRadius;
    case "nationwide":
      return Infinity;
    default:
      return 0;
  }
};

export const getDeliveryTier = (distanceMeters, settings) => {
  if (distanceMeters <= settings.delivery.neighbourhoodRadius) {
    return { tier: "neighbourhood", estimate: "Delivery today" };
  }
  if (distanceMeters <= settings.delivery.cityRadius) {
    return { tier: "city", estimate: "Delivery in 1-2 days" };
  }
  return { tier: "regional", estimate: "Delivery in 2-4 days" };
};

/**
 * Price one shop's delivery.
 *
 * `settings` is optional so a multi-shop checkout can fetch the config once
 * and pass it in, instead of hitting the database per shop.
 *
 * `remainingSubsidyBudget` is what makes settings.delivery.freeDelivery
 * .maxSubsidyPerOrder real. On a three-shop order the caller passes what is
 * left of the per-order cap, so the platform cannot be billed three full
 * subsidies for one basket.
 */
export const calculateDeliveryFee = async (
  distanceMeters,
  subtotal,
  settings = null,
  remainingSubsidyBudget = Infinity,
) => {
  const config = settings || (await Settings.get());
  const { baseFee, perKmRate, freeDelivery } = config.delivery;

  const distanceKm = distanceMeters / 1000;
  const rawFee = round(baseFee + distanceKm * perKmRate);

  const now = new Date();
  const withinWindow =
    (!freeDelivery.startsAt || now >= freeDelivery.startsAt) &&
    (!freeDelivery.endsAt || now <= freeDelivery.endsAt);

  const qualifies =
    freeDelivery.enabled &&
    withinWindow &&
    remainingSubsidyBudget > 0 &&
    subtotal >= freeDelivery.minOrderValue &&
    distanceMeters <= freeDelivery.maxDistance;

  if (!qualifies) {
    return { fee: rawFee, rawFee, subsidy: 0, isFree: false };
  }

  // Three ceilings apply at once: the fee itself, the per-shop cap, and
  // whatever is left of the per-order cap. The smallest one wins.
  const subsidy = round(
    Math.min(rawFee, freeDelivery.maxSubsidy, remainingSubsidyBudget),
  );
  const fee = round(rawFee - subsidy);

  return { fee, rawFee, subsidy, isFree: fee === 0 };
};

/**
 * Straight-line distance between two [longitude, latitude] pairs, in metres.
 * Haversine - under-estimates real road distance by roughly 30% in a city.
 */
export const getDistanceMeters = (coords1, coords2) => {
  const [lng1, lat1] = coords1;
  const [lng2, lat2] = coords2;

  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
