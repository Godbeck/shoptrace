/**
 * The platform's categories and their variant axes. Mirrors
 * server/src/utils/categories.js - if one changes, change both, or a merchant
 * will be offered something the API will reject.
 *
 * Food was removed: ShopTrace is not doing groceries or prepared food.
 */
export const CATEGORIES = [
  "Phones & Tablets",
  "Computers",
  "Electronics",
  "Fashion",
  "Shoes",
  "Bags & Accessories",
  "Beauty & Personal Care",
  "Health",
  "Home",
  "Furniture",
  "Hardware",
  "Building Materials",
  "Baby & Kids",
  "Sports & Outdoors",
  "Automotive",
  "Books & Stationery",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * For customer-facing filter chips. "Other" is noise in a filter row, and
 * seventeen chips is a scroll nobody finishes - these are the ones worth
 * putting in front of someone browsing.
 */
export const BROWSE_CATEGORIES = [
  "Phones & Tablets",
  "Fashion",
  "Shoes",
  "Electronics",
  "Computers",
  "Home",
  "Furniture",
  "Hardware",
  "Building Materials",
  "Beauty & Personal Care",
  "Baby & Kids",
  "Sports & Outdoors",
  "Automotive",
];

/* ------------------------------------------------------------- variants */

const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47"];
const KIDS_SIZES = ["0-3m", "3-6m", "6-12m", "1-2y", "2-3y", "3-4y", "4-5y", "6-7y", "8-9y", "10-11y", "12-13y"];
const STORAGE = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];

export type VariantSpec = {
  color: boolean;
  size: { label: string; suggestions: string[] } | null;
};

/**
 * A product varies along at most TWO axes: colour and "size", where "size" is
 * relabelled per category - storage for a phone, a number for a shoe, a letter
 * for a shirt. Same field, same stock maths, different word in front of the
 * merchant.
 *
 * Suggestions are chips; the merchant can always type their own, because no
 * list survives contact with a real market.
 */
export const CATEGORY_VARIANTS: Record<string, VariantSpec> = {
  "Phones & Tablets": { color: true, size: { label: "Storage", suggestions: STORAGE } },
  Computers: { color: true, size: { label: "Storage", suggestions: STORAGE } },
  Electronics: { color: true, size: null },
  Fashion: { color: true, size: { label: "Size", suggestions: LETTER_SIZES } },
  Shoes: { color: true, size: { label: "Size", suggestions: SHOE_SIZES } },
  "Bags & Accessories": { color: true, size: null },
  "Beauty & Personal Care": { color: true, size: null },
  Health: { color: false, size: null },
  Home: { color: true, size: null },
  Furniture: { color: true, size: null },
  Hardware: { color: false, size: null },
  "Building Materials": { color: false, size: null },
  "Baby & Kids": { color: true, size: { label: "Size", suggestions: KIDS_SIZES } },
  "Sports & Outdoors": { color: true, size: { label: "Size", suggestions: LETTER_SIZES } },
  Automotive: { color: true, size: null },
  "Books & Stationery": { color: false, size: null },
  Other: { color: true, size: { label: "Size", suggestions: [] } },
};

export const variantsFor = (category: string): VariantSpec =>
  CATEGORY_VARIANTS[category] ?? { color: false, size: null };

export const supportsVariants = (category: string): boolean => {
  const spec = variantsFor(category);
  return Boolean(spec.color || spec.size);
};

/** Common colours, as chips. Free text covers everything else. */
export const COLOR_SUGGESTIONS = [
  "Black", "White", "Blue", "Red", "Green",
  "Grey", "Brown", "Gold", "Silver", "Pink",
];

/** "Blue / 45", or just "Blue" - however much the variant actually names. */
export const variantLabel = (v: { color?: string; size?: string }): string =>
  [v.color, v.size].filter(Boolean).join(" / ");

/**
 * The combined variant axes for a product listed under several categories.
 *
 * A union, not an intersection. A jacket in both Fashion and Sports & Outdoors
 * should still offer sizes; taking the intersection would strip the axis the
 * moment a merchant added a second, plainer category - punishing them for
 * describing their product more fully.
 *
 * The size LABEL comes from the first category that defines one, so a phone
 * cross-listed under Electronics still says "Storage" rather than "Size".
 */
export const variantsForCategories = (categories: string[] = []): VariantSpec => {
  const specs = categories.map(variantsFor);
  return {
    color: specs.some((s) => s.color),
    size: specs.find((s) => s.size)?.size ?? null,
  };
};
