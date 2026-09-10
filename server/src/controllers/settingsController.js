import Settings from "../models/Settings.js";

/**
 * The allowlist, as dot-paths. Same idea as allowedFields on a product update,
 * but the settings document is nested, so the paths are nested too.
 *
 * Anything not on this list cannot be written - including `key`, which would
 * break the singleton, and `createdAt`.
 */
const ALLOWED_PATHS = [
  "delivery.baseFee",
  "delivery.perKmRate",
  "delivery.neighbourhoodRadius",
  "delivery.cityRadius",
  "delivery.freeDelivery.enabled",
  "delivery.freeDelivery.minOrderValue",
  "delivery.freeDelivery.maxDistance",
  "delivery.freeDelivery.maxSubsidy",
  "delivery.freeDelivery.maxSubsidyPerOrder",
  "delivery.freeDelivery.startsAt",
  "delivery.freeDelivery.endsAt",
  "platformFeePercent",
  "orderTimeoutMinutes",
  "subscriptionTiers.free.productLimit",
  "subscriptionTiers.free.price",
  "subscriptionTiers.growth.productLimit",
  "subscriptionTiers.growth.price",
  "subscriptionTiers.pro.productLimit",
  "subscriptionTiers.pro.price",
  "featuredListingWeeklyPrice",
];

/** Paths that must be a number and must not be negative. */
const NON_NEGATIVE_NUMBERS = ALLOWED_PATHS.filter(
  (path) =>
    !path.endsWith("enabled") &&
    !path.endsWith("startsAt") &&
    !path.endsWith("endsAt"),
);

/**
 * Turn { delivery: { baseFee: 12 } } into { 'delivery.baseFee': 12 }.
 * Flattening lets one flat allowlist cover a nested body.
 */
const flatten = (input, prefix = "", output = {}) => {
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const isPlainObject =
      value !== null && typeof value === "object" && !Array.isArray(value);

    if (isPlainObject) {
      flatten(value, path, output);
    } else {
      output[path] = value;
    }
  }
  return output;
};

// GET /api/settings  (admin)
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.get();
    res.status(200).json(settings);
  } catch (error) {
    console.error("getSettings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/settings/public
 *
 * The clients genuinely need some of this: the app has to group search results
 * into distance bands and preview a delivery fee before checkout, and those
 * numbers live here. Everything commercial - fee percentages, subscription
 * pricing - stays out.
 */
export const getPublicSettings = async (req, res) => {
  try {
    const settings = await Settings.get();
    const { freeDelivery } = settings.delivery;

    res.status(200).json({
      delivery: {
        baseFee: settings.delivery.baseFee,
        perKmRate: settings.delivery.perKmRate,
        neighbourhoodRadius: settings.delivery.neighbourhoodRadius,
        cityRadius: settings.delivery.cityRadius,
        freeDelivery: {
          enabled: freeDelivery.enabled,
          minOrderValue: freeDelivery.minOrderValue,
          maxDistance: freeDelivery.maxDistance,
        },
      },
      orderTimeoutMinutes: settings.orderTimeoutMinutes,
    });
  } catch (error) {
    console.error("getPublicSettings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/settings  (admin)
export const updateSettings = async (req, res) => {
  try {
    const updates = flatten(req.body || {});
    const paths = Object.keys(updates);

    if (paths.length === 0) {
      return res.status(400).json({ message: "No settings supplied" });
    }

    // Rejected loudly rather than ignored quietly - an admin who typos a
    // field name should be told, not left believing the change was saved.
    const rejected = paths.filter((path) => !ALLOWED_PATHS.includes(path));
    if (rejected.length > 0) {
      return res.status(400).json({
        message: "These settings cannot be changed here",
        rejected,
      });
    }

    for (const path of paths) {
      const value = updates[path];

      if (NON_NEGATIVE_NUMBERS.includes(path)) {
        if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
          return res
            .status(400)
            .json({ message: `${path} must be a number of 0 or more` });
        }
      }
      if (path === "platformFeePercent" && value > 100) {
        return res
          .status(400)
          .json({ message: "platformFeePercent cannot be above 100" });
      }
      if (path.endsWith("enabled") && typeof value !== "boolean") {
        return res.status(400).json({ message: `${path} must be true or false` });
      }
    }

    if (
      updates["delivery.neighbourhoodRadius"] !== undefined &&
      updates["delivery.cityRadius"] !== undefined &&
      updates["delivery.neighbourhoodRadius"] > updates["delivery.cityRadius"]
    ) {
      return res.status(400).json({
        message: "The neighbourhood radius cannot be larger than the city radius",
      });
    }

    const settings = await Settings.get();

    // Mongoose's .set() understands dot-paths on a nested document.
    for (const path of paths) {
      settings.set(path, updates[path]);
    }

    await settings.save();

    res.status(200).json(settings);
  } catch (error) {
    console.error("updateSettings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
