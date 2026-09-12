/**
 * The platform's categories, in one place so a shop, a product and a filter
 * can never disagree about what exists.
 *
 * Food was removed deliberately - ShopTrace is not doing groceries or
 * prepared food, which carry perishability and delivery-time problems the
 * rest of the catalogue does not.
 */
export const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home",
  "Hardware",
  "Other",
];

export const isCategory = (value) => CATEGORIES.includes(value);
