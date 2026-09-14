/**
 * The shapes the shared card components render.
 *
 * These are deliberately NOT the API types. A product card needs "from
 * GH₵ 890" and "4 shops nearby", which are properties of a comparison rather
 * than of a single product row. Keeping a view model in between means the
 * cards do not have to change when an endpoint does.
 *
 * `adapt.ts` is the only place that builds these.
 */
export type CardProduct = {
  _id: string;
  name: string;
  brand?: string;
  /** The primary category - what the icon and the single-line chip use. */
  category: string;
  /** Every category the merchant chose, in their order. */
  categories: string[];
  /** The lowest price seen for this product. */
  fromPrice: number;
  /** Set only when there is a drop to show. */
  previousPrice?: number;
  /** How many shops stock it. 1 when the API has not grouped by product. */
  shopCount: number;
  /** The cover photo - the first of the product's images. Often absent. */
  imageUrl?: string;
  inStock: boolean;
  isFeatured: boolean;
  distanceMeters: number;
};

export type CardShop = {
  _id: string;
  name: string;
  /** Already joined for display. */
  category: string;
  categories: string[];
  /** Human-readable location - the shop's address line. */
  area: string;
  distanceMeters: number;
  averageRating: number;
  reviewCount: number;
  status: "pending" | "verified" | "suspended";
  isFeatured: boolean;
  /** The shop's logo. Often absent. */
  imageUrl?: string;
};
