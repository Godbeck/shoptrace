// User is imported for its side effect: importing a model file is what
// registers the schema with Mongoose. The worker is a separate process from
// the API, so nothing else pulls User in - and .populate('customer') below
// fails with "Schema hasn't been registered for model User" without this.
import "../models/User.js";
import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import Order from "../models/Order.js";
import PriceAlert from "../models/PriceAlert.js";
import { expireOrders } from "../utils/expireOrders.js";

/** Cancel unpaid orders past their hold and give the stock back. */
export const runExpireOrders = async () => {
  const result = await expireOrders();
  return result;
};

/** Featured placement that has been paid for until a date, and no longer. */
export const runExpireFeaturedListings = async () => {
  const result = await Product.updateMany(
    { isFeatured: true, featuredUntil: { $lte: new Date() } },
    { $set: { isFeatured: false }, $unset: { featuredUntil: "" } },
  );

  return { unfeatured: result.modifiedCount };
};

/**
 * A product's price dropped - tell whoever was waiting for it.
 *
 * Queued from the Product post('save') hook, so it fires wherever the price
 * changes rather than only from the merchant's edit endpoint.
 */
export const runCheckPriceAlerts = async ({ productId, price }) => {
  const alerts = await PriceAlert.find({
    product: productId,
    isActive: true,
    targetPrice: { $gte: price },
  }).populate("customer", "name email phone");

  if (alerts.length === 0) {
    return { matched: 0 };
  }

  const product = await Product.findById(productId);

  for (const alert of alerts) {
    // TODO: replace with a real push notification once Expo push is wired up.
    // The matching is the part worth getting right; the delivery channel is
    // a swap of these two lines.
    console.log(
      `PRICE ALERT -> ${alert.customer?.phone}: "${product?.name}" is now GH${price} ` +
        `(target GH${alert.targetPrice}, was GH${alert.priceWhenSet}) at ${product?.shopName}`,
    );

    alert.lastNotifiedAt = new Date();
    // Deactivated after firing, so one long price war does not send the same
    // customer a notification every hour.
    alert.isActive = false;
    await alert.save();
  }

  return { matched: alerts.length };
};

/**
 * Fix the denormalised shopName on a shop's products after a rename.
 *
 * Product.shopName is a deliberate copy so product search needs no join. The
 * price of that copy is exactly this job.
 */
export const runSyncShopName = async ({ shopId }) => {
  const shop = await Shop.findById(shopId);

  if (!shop) {
    return { updated: 0, reason: "shop not found" };
  }

  const result = await Product.updateMany(
    { shop: shop._id, shopName: { $ne: shop.name } },
    { $set: { shopName: shop.name, location: shop.location } },
  );

  return { updated: result.modifiedCount, shopName: shop.name };
};

/** Per-shop sales summary for the week. */
export const runWeeklyMerchantReport = async () => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const summaries = await Order.aggregate([
    { $match: { paymentStatus: "paid", createdAt: { $gte: weekAgo } } },
    { $unwind: "$subOrders" },
    {
      $group: {
        _id: "$subOrders.shop",
        shopName: { $first: "$subOrders.shopName" },
        orders: { $sum: 1 },
        revenue: { $sum: "$subOrders.subtotal" },
        completed: {
          $sum: {
            $cond: [{ $eq: ["$subOrders.status", "completed"] }, 1, 0],
          },
        },
        declined: {
          $sum: { $cond: [{ $eq: ["$subOrders.status", "declined"] }, 1, 0] },
        },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  // TODO: send by email once an email provider is configured. The aggregation
  // is the real work; sending is a call to Resend with this data.
  summaries.forEach((row) => {
    console.log(
      `WEEKLY REPORT ${row.shopName}: ${row.orders} orders, ` +
        `GH${Math.round(row.revenue * 100) / 100} revenue, ` +
        `${row.completed} completed, ${row.declined} declined`,
    );
  });

  return { shopsReported: summaries.length };
};
