import mongoose from "mongoose";
import Shop from "../models/Shop.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Settings from "../models/Settings.js";
import { sendError } from "../utils/apiError.js";
import { AGING_MS, fulfilmentRate } from "../utils/stockConfidence.js";

/**
 * Everything the merchant home and analytics screens need, computed from real
 * orders rather than stored counters.
 *
 * All of it is scoped to the requester's OWN shop, found from req.user._id.
 * There is no shopId parameter anywhere in this file.
 */

const round = (value) => Math.round(value * 100) / 100;

/** Sub-orders in these states represent money the merchant actually earned. */
const EARNED = ["completed"];
/** Everything except the states where the order fell through. */
const LIVE = [
  "pending",
  "accepted",
  "packed",
  "out_for_delivery",
  "ready_for_pickup",
  "completed",
];

// GET /api/merchant/summary?days=30
export const getShopSummary = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res
        .status(404)
        .json({ message: "You have not registered a shop yet" });
    }

    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const shopId = new mongoose.Types.ObjectId(shop._id);

    const [settings, productStats, orderStats, byDay, topProducts] =
      await Promise.all([
        Settings.get(),

        // Product counts and total views, straight off the products.
        Product.aggregate([
          { $match: { shop: shopId, isActive: true } },
          {
            $group: {
              _id: null,
              products: { $sum: 1 },
              views: { $sum: "$viewCount" },
              staleStock: {
                $sum: {
                  $cond: [
                    {
                      $lte: [
                        { $ifNull: ["$stockConfirmedAt", new Date(0)] },
                        new Date(Date.now() - AGING_MS),
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              outOfStock: {
                $sum: { $cond: [{ $lte: ["$stockCount", 0] }, 1, 0] },
              },
              lowStock: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ["$stockCount", 0] },
                        { $lte: ["$stockCount", 5] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),

        // Revenue and order counts. $unwind splits the order into its
        // sub-orders, then the $match keeps only this shop's - which is what
        // makes a multi-shop order contribute only its own slice.
        Order.aggregate([
          { $match: { paymentStatus: "paid", createdAt: { $gte: since } } },
          { $unwind: "$subOrders" },
          { $match: { "subOrders.shop": shopId } },
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [
                    { $in: ["$subOrders.status", EARNED] },
                    "$subOrders.subtotal",
                    0,
                  ],
                },
              },
              pipeline: {
                $sum: {
                  $cond: [
                    { $in: ["$subOrders.status", LIVE] },
                    "$subOrders.subtotal",
                    0,
                  ],
                },
              },
              completed: {
                $sum: { $cond: [{ $eq: ["$subOrders.status", "completed"] }, 1, 0] },
              },
              declined: {
                $sum: { $cond: [{ $eq: ["$subOrders.status", "declined"] }, 1, 0] },
              },
              pending: {
                $sum: { $cond: [{ $eq: ["$subOrders.status", "pending"] }, 1, 0] },
              },
            },
          },
        ]),

        // Revenue per calendar day, for the chart.
        Order.aggregate([
          { $match: { paymentStatus: "paid", createdAt: { $gte: since } } },
          { $unwind: "$subOrders" },
          { $match: { "subOrders.shop": shopId } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              revenue: { $sum: "$subOrders.subtotal" },
              orders: { $sum: 1 },
              // 1 = Sunday in MongoDB's $dayOfWeek.
              weekday: { $first: { $dayOfWeek: "$createdAt" } },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Top sellers by revenue.
        Order.aggregate([
          { $match: { paymentStatus: "paid", createdAt: { $gte: since } } },
          { $unwind: "$subOrders" },
          { $match: { "subOrders.shop": shopId } },
          { $unwind: "$subOrders.items" },
          {
            $group: {
              _id: "$subOrders.items.product",
              name: { $first: "$subOrders.items.name" },
              units: { $sum: "$subOrders.items.quantity" },
              revenue: { $sum: "$subOrders.items.lineTotal" },
              orders: { $sum: 1 },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
        ]),
      ]);

    const products = productStats[0] ?? {
      products: 0,
      views: 0,
      outOfStock: 0,
      lowStock: 0,
      staleStock: 0,
    };
    const orders = orderStats[0] ?? {
      orders: 0,
      revenue: 0,
      pipeline: 0,
      completed: 0,
      declined: 0,
      pending: 0,
    };

    const tier = shop.subscriptionTier || "free";
    const expired =
      tier !== "free" &&
      shop.subscriptionExpiresAt &&
      shop.subscriptionExpiresAt <= new Date();
    const effectiveTier = expired ? "free" : tier;

    // Views are real. Clicks and add-to-cart are NOT tracked anywhere, so the
    // funnel is returned with only the steps that exist - inventing the middle
    // two would make the screen lie.
    const funnel = [
      { label: "Product views", value: products.views },
      { label: "Orders", value: orders.orders },
      { label: "Completed", value: orders.completed },
    ];

    res.status(200).json({
      shop: {
        _id: shop._id,
        name: shop.name,
        status: shop.status,
        address: shop.address,
        categories: shop.categories,
        deliveryRange: shop.deliveryRange,
        averageRating: shop.averageRating,
        reviewCount: shop.reviewCount,
        isFeatured: shop.isFeatured,
        subscriptionTier: effectiveTier,
        subscriptionExpiresAt: shop.subscriptionExpiresAt,
      },
      period: { days, since },
      stats: {
        revenue: round(orders.revenue),
        pipelineValue: round(orders.pipeline),
        orders: orders.orders,
        completed: orders.completed,
        declined: orders.declined,
        pendingOrders: orders.pending,
        views: products.views,
        products: products.products,
        outOfStock: products.outOfStock,
        lowStock: products.lowStock,
        staleStock: products.staleStock ?? 0,
        fulfilmentRate: fulfilmentRate(shop),
        fulfilledCount: shop.fulfilledCount ?? 0,
        declinedCount: shop.declinedCount ?? 0,
        averageOrder: orders.orders ? round(orders.revenue / orders.orders) : 0,
        // Orders divided by views. Honest about being 0 when nobody has looked.
        conversionRate: products.views
          ? round((orders.orders / products.views) * 100)
          : 0,
        productLimit: settings.subscriptionTiers[effectiveTier].productLimit,
      },
      byDay: byDay.map((d) => ({
        date: d._id,
        revenue: round(d.revenue),
        orders: d.orders,
        weekday: d.weekday,
      })),
      topProducts: topProducts.map((p) => ({
        product: p._id,
        name: p.name,
        units: p.units,
        orders: p.orders,
        revenue: round(p.revenue),
      })),
      funnel,
    });
  } catch (error) {
    return sendError(res, error, "getShopSummary error:");
  }
};
