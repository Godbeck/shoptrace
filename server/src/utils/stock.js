import Product from "../models/Product.js";

// Both writes below use an aggregation-pipeline update rather than a plain
// $inc. The reason: `inStock` is derived from `stockCount`, and the pre('save')
// hook that normally keeps it in sync does not run on findOneAndUpdate. Two
// $set stages in one pipeline let MongoDB recalculate `inStock` from the value
// it just wrote, inside the same atomic operation.

/**
 * Take `quantity` off a product's stock, but only if that much is really there.
 * Returns the updated product, or null if the stock was not available -
 * which means another request got there first.
 */
export const reserveStock = async (productId, quantity) => {
  return Product.findOneAndUpdate(
    { _id: productId, stockCount: { $gte: quantity }, isActive: true },
    [
      { $set: { stockCount: { $subtract: ["$stockCount", quantity] } } },
      { $set: { inStock: { $gt: ["$stockCount", 0] } } },
    ],
    // updatePipeline is required by Mongoose 9 before it will pass an
    // aggregation pipeline through as the update instead of treating the
    // array as a document.
    { new: true, updatePipeline: true },
  );
};

/**
 * Put stock back. Takes the same [{ product, quantity }] shape that the
 * checkout loop collects, so a failed checkout can hand its whole reservation
 * list straight back.
 *
 * Never throws. A release failing is bad - it leaves stock stuck - but the
 * caller is already handling an error, and a second error thrown here would
 * hide the first one. So failures are logged loudly instead.
 */
export const releaseStock = async (reservations = []) => {
  if (reservations.length === 0) return;

  const results = await Promise.allSettled(
    reservations.map(({ product, quantity }) =>
      Product.updateOne(
        { _id: product },
        [
          { $set: { stockCount: { $add: ["$stockCount", quantity] } } },
          { $set: { inStock: { $gt: ["$stockCount", 0] } } },
        ],
        { updatePipeline: true },
      ),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        "STOCK RELEASE FAILED - manual correction needed:",
        reservations[index],
        result.reason,
      );
    }
  });
};

/** Turn a sub-order's items into the shape releaseStock expects. */
export const reservationsFromItems = (items = []) =>
  items.map((item) => ({ product: item.product, quantity: item.quantity }));
