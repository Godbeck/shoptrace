import mongoose from "mongoose";
import Product from "../models/Product.js";

// Every write below uses an aggregation-pipeline update rather than a plain
// $inc. The reason: `inStock` is derived from `stockCount`, and the pre('save')
// hook that normally keeps it in sync does not run on findOneAndUpdate. Stages
// in one pipeline let MongoDB recalculate the derived fields from the values it
// just wrote, inside the same atomic operation.

/**
 * Recalculate the two derived fields from the variants array.
 *
 * Shared by both paths so a product can never end up with a stockCount that
 * disagrees with the variants it was summed from.
 */
const deriveTotals = [
  {
    $set: {
      stockCount: {
        $cond: [
          { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
          { $sum: "$variants.stockCount" },
          "$stockCount",
        ],
      },
    },
  },
  { $set: { inStock: { $gt: ["$stockCount", 0] } } },
];

/**
 * Subtract `quantity` from ONE variant, leaving every other variant alone.
 *
 * $map rebuilds the array with only the matching element changed - there is no
 * positional operator that works inside a pipeline update, and rebuilding is
 * what keeps this a single atomic document write rather than a read, a splice
 * and a write with a race in the middle.
 */
const adjustVariant = (variantId, delta) => [
  {
    $set: {
      variants: {
        $map: {
          input: "$variants",
          as: "v",
          in: {
            $cond: [
              { $eq: ["$$v._id", variantId] },
              {
                $mergeObjects: [
                  "$$v",
                  { stockCount: { $add: ["$$v.stockCount", delta] } },
                ],
              },
              "$$v",
            ],
          },
        },
      },
    },
  },
  ...deriveTotals,
];

/**
 * Take `quantity` off a product's stock, but only if that much is really there.
 * Returns the updated product, or null if the stock was not available - which
 * means another request got there first.
 *
 * `variantId` is optional. Without it this behaves exactly as it always has,
 * so every product that does not vary is untouched by the variant work.
 */
export const reserveStock = async (productId, quantity, variantId = null) => {
  if (variantId) {
    const id = new mongoose.Types.ObjectId(String(variantId));

    return Product.findOneAndUpdate(
      {
        _id: productId,
        isActive: true,
        // $elemMatch, not two dotted conditions. `variants._id: x` AND
        // `variants.stockCount: {$gte: n}` would be satisfied by a document
        // where a DIFFERENT variant has the stock - and we would sell size 45
        // on the strength of size 40's shelf.
        variants: { $elemMatch: { _id: id, stockCount: { $gte: quantity } } },
      },
      adjustVariant(id, -quantity),
      { new: true, updatePipeline: true },
    );
  }

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
 * Put stock back. Takes the same [{ product, quantity, variant }] shape the
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
    reservations.map(({ product, quantity, variant }) =>
      variant
        ? Product.updateOne(
            { _id: product },
            adjustVariant(new mongoose.Types.ObjectId(String(variant)), quantity),
            { updatePipeline: true },
          )
        : Product.updateOne(
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
  items.map((item) => ({
    product: item.product,
    quantity: item.quantity,
    variant: item.variant ?? null,
  }));
