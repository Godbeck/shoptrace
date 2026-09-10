import Settings from "../models/Settings.js";

export const getDeliveryTier = (distanceMeters, settings) => {
  if (distanceMeters <= settings.delivery.neighbourhoodRadius) {
    return { tier: "neighbourhood", estimate: "Delivery today" };
  }
  if (distanceMeters <= settings.delivery.cityRadius) {
    return { tier: "city", estimate: "Delivery in 1-2 days" };
  }
  return { tier: "regional", estimate: "Delivery in 2-4 days" };
};

export const calculateDeliveryFee = async (
  distanceMeters,
  subtotal,
  settings = null,
) => {
  const config = settings || (await Settings.get());
  const { baseFee, perKmRate, freeDelivery } = config.delivery;

  const distanceKm = distanceMeters / 1000;
  const rawFee = Math.round((baseFee + distanceKm * perKmRate) * 100) / 100;

  const now = new Date();
  const withinWindow =
    (!freeDelivery.startsAt || now >= freeDelivery.startsAt) &&
    (!freeDelivery.endsAt || now <= freeDelivery.endsAt);

  const qualifies =
    freeDelivery.enabled &&
    withinWindow &&
    subtotal >= freeDelivery.minOrderValue &&
    distanceMeters <= freeDelivery.maxDistance;

  if (!qualifies) {
    return { fee: rawFee, rawFee, subsidy: 0, isFree: false };
  }

  const subsidy = Math.min(rawFee, freeDelivery.maxSubsidy);
  const fee = Math.round((rawFee - subsidy) * 100) / 100;

  return { fee, rawFee, subsidy, isFree: fee === 0 };
};

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
