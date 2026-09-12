/**
 * The platform's categories. Mirrors server/src/utils/categories.js - if one
 * changes, change both, or a merchant will be offered something the API will
 * reject.
 *
 * Food was removed: ShopTrace is not doing groceries or prepared food.
 */
export const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home",
  "Hardware",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** For customer-facing filters, where "Other" is noise. */
export const BROWSE_CATEGORIES = ["Electronics", "Fashion", "Home", "Hardware"];
