/**
 * The platform's categories, and what variants each one supports.
 *
 * One place, so a shop, a product, a filter and the product form can never
 * disagree about what exists.
 *
 * Food was removed deliberately - ShopTrace is not doing groceries or prepared
 * food, which carry perishability and delivery-time problems the rest of the
 * catalogue does not.
 *
 * The original five (Electronics, Fashion, Home, Hardware, Other) are kept
 * under their exact old names. Renaming "Home" to "Home & Kitchen" would have
 * read better but would orphan every existing shop and product until a
 * migration ran, and a migration that can silently mis-map live data is a
 * worse trade than a slightly plainer word.
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
];

export const isCategory = (value) => CATEGORIES.includes(value);

/* ------------------------------------------------------------- variants */

/**
 * A product varies along at most TWO axes: colour and "size".
 *
 * Two is a deliberate ceiling, not a limitation we ran out of time to lift.
 * Every extra axis multiplies the grid a merchant has to fill in - three axes
 * of five options each is 125 rows of stock to type on a phone, which nobody
 * will do, so the numbers would be wrong and the trust model that rests on
 * them would be worthless.
 *
 * "Size" is the generic second axis, relabelled per category: a phone's second
 * axis is storage, a shoe's is a number, a shirt's is a letter. Same field,
 * same stock maths, different word in front of the merchant.
 */
const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47"];
const KIDS_SIZES = ["0-3m", "3-6m", "6-12m", "1-2y", "2-3y", "3-4y", "4-5y", "6-7y", "8-9y", "10-11y", "12-13y"];
const STORAGE = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];

/**
 * What each category offers. `size` null means the axis does not apply.
 * `suggestions` are chips in the form - a merchant can always type their own,
 * because no list survives contact with a real market.
 */
export const CATEGORY_VARIANTS = {
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

/** What a category supports, safe for an unknown value. */
export const variantsFor = (category) =>
  CATEGORY_VARIANTS[category] ?? { color: false, size: null };

/** Does this category let a product carry variants at all? */
export const supportsVariants = (category) => {
  const spec = variantsFor(category);
  return Boolean(spec.color || spec.size);
};

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
export const variantsForCategories = (categories = []) => {
  const specs = categories.map(variantsFor);

  return {
    color: specs.some((s) => s.color),
    size: specs.find((s) => s.size)?.size ?? null,
  };
};
