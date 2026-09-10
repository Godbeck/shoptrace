import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import Settings from "../models/Settings.js";
import generateOrderNumber from "../utils/generateOrderNumber.js";
import {
  reserveStock,
  releaseStock,
  reservationsFromItems,
} from "../utils/stock.js";
import {
  getDeliveryTier,
  getRangeMaxDistance,
  calculateDeliveryFee,
  getDistanceMeters,
} from "../utils/deliveryCalculator.js";

/**
 * Which status a sub-order is allowed to move to next. Written as data, not as
 * a chain of if-statements, so the rules can be read in one glance and so an
 * illegal jump - pending straight to completed - is impossible by omission
 * rather than by remembering to forbid it.
 */
const ALLOWED_TRANSITIONS = {
  pending: ["accepted", "declined"],
  accepted: ["packed", "cancelled"],
  packed: ["out_for_delivery", "ready_for_pickup", "cancelled"],
  out_for_delivery: ["completed"],
  ready_for_pickup: ["completed"],
  completed: [],
  declined: [],
  cancelled: [],
};

/** A sub-order in one of these states still has stock held for it. */
const HOLDS_STOCK = [
  "pending",
  "accepted",
  "packed",
  "out_for_delivery",
  "ready_for_pickup",
];

const round = (value) => Math.round(value * 100) / 100;

/**
 * A failure that the client caused and should see the reason for, carrying the
 * status code it deserves. Throwing instead of returning matters: every exit
 * from checkout then runs through one catch block, and that catch block is
 * what hands reserved stock back. An early `return` would skip it.
 */
class CheckoutError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Strip a full order down to just the requesting shop's own sub-order.
 *
 * This is a privacy boundary, not a convenience. A multi-shop order holds
 * other merchants' items and the customer's total spend across all of them.
 * A merchant must see their own slice and nothing else - note that grandTotal
 * is deliberately absent.
 */
const shapeForShop = (order, shopId) => {
  const subOrder = order.subOrders.find(
    (sub) => sub.shop.toString() === shopId.toString(),
  );

  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryLocation: order.deliveryLocation,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    subOrder,
  };
};

// POST /api/orders
export const createOrder = async (req, res) => {
  // Declared out here so the catch block can still see it. Every successful
  // reservation is pushed on immediately, so whatever has been taken from
  // stock is always recoverable.
  const reservations = [];
  let committed = false;

  try {
    const { items, deliveryAddress, latitude, longitude } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new CheckoutError(400, "Your cart is empty");
    }
    if (latitude === undefined || longitude === undefined) {
      throw new CheckoutError(400, "A delivery location is required");
    }

    // 1. Validate and normalise the cart before touching the database.
    //    Duplicate lines for the same product are merged, so a cart with
    //    "2 of X" and "1 of X" reserves 3 once rather than racing itself.
    const quantityByProduct = new Map();

    for (const item of items) {
      if (!mongoose.isValidObjectId(item?.product)) {
        throw new CheckoutError(400, "Cart contains an invalid product id");
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new CheckoutError(
          400,
          "Every cart item needs a whole quantity of at least 1",
        );
      }
      const key = item.product.toString();
      quantityByProduct.set(key, (quantityByProduct.get(key) || 0) + quantity);
    }

    // 2. One query for every product in the cart, not one per item.
    const productIds = [...quantityByProduct.keys()];
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    });

    if (products.length !== productIds.length) {
      throw new CheckoutError(
        404,
        "One or more items in your cart are no longer available",
      );
    }

    // 3. The shops must still be verified. A shop can be suspended between
    //    adding to cart and checking out.
    const shopIds = [...new Set(products.map((p) => p.shop.toString()))];
    const shops = await Shop.find({
      _id: { $in: shopIds },
      status: "verified",
    });
    const shopsById = new Map(shops.map((shop) => [shop._id.toString(), shop]));

    for (const product of products) {
      if (!shopsById.has(product.shop.toString())) {
        throw new CheckoutError(
          409,
          `${product.name} is sold by a shop that is not currently active`,
        );
      }
    }

    // 4. Group the cart by shop. One sub-order per shop.
    const groups = new Map();
    for (const product of products) {
      const shopId = product.shop.toString();
      if (!groups.has(shopId)) {
        groups.set(shopId, { shop: shopsById.get(shopId), lines: [] });
      }
      groups.get(shopId).lines.push({
        product,
        quantity: quantityByProduct.get(product._id.toString()),
      });
    }

    // Fetched once and passed down, so a five-shop order does not read the
    // settings document five times.
    const settings = await Settings.get();
    const customerCoords = [parseFloat(longitude), parseFloat(latitude)];

    const subOrders = [];
    let itemsTotal = 0;
    let deliveryTotal = 0;
    let totalSubsidyUsed = 0;

    for (const { shop, lines } of groups.values()) {
      const orderItems = [];
      let subtotal = 0;

      for (const { product, quantity } of lines) {
        // 5. The reservation. Condition and decrement in one atomic write.
        const reserved = await reserveStock(product._id, quantity);

        if (!reserved) {
          throw new CheckoutError(
            409,
            `${product.name} no longer has ${quantity} in stock`,
          );
        }
        reservations.push({ product: product._id, quantity });

        // 6. The snapshot. Copied values, not a live reference, so this order
        //    still reads correctly if the product is later renamed or repriced.
        const lineTotal = round(product.price * quantity);
        subtotal = round(subtotal + lineTotal);

        orderItems.push({
          product: product._id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          quantity,
          imageUrl: product.imageUrls?.[0] || "",
          lineTotal,
        });
      }

      // 7. Delivery, decided entirely by the server.
      const distanceMeters = getDistanceMeters(
        shop.location.coordinates,
        customerCoords,
      );
      const maxDistance = getRangeMaxDistance(shop.deliveryRange, settings);

      let deliveryMethod = "pickup";
      let deliveryFee = 0;
      let deliveryFeeRaw = 0;
      let deliverySubsidy = 0;
      let deliveryTier;
      let deliveryEstimate;

      if (distanceMeters <= maxDistance) {
        deliveryMethod = "delivery";

        // What is left of the platform's promotion budget for this basket.
        const remainingSubsidyBudget = round(
          Math.max(
            settings.delivery.freeDelivery.maxSubsidyPerOrder - totalSubsidyUsed,
            0,
          ),
        );

        const priced = await calculateDeliveryFee(
          distanceMeters,
          subtotal,
          settings,
          remainingSubsidyBudget,
        );

        deliveryFee = priced.fee;
        deliveryFeeRaw = priced.rawFee;
        deliverySubsidy = priced.subsidy;
        totalSubsidyUsed = round(totalSubsidyUsed + priced.subsidy);

        const tierInfo = getDeliveryTier(distanceMeters, settings);
        deliveryTier = tierInfo.tier;
        deliveryEstimate = tierInfo.estimate;
      }
      // Out of range is not an error. The sub-order simply becomes pickup,
      // and the cart screen is where the customer should have been told.

      subOrders.push({
        shop: shop._id,
        shopName: shop.name,
        shopPhone: shop.phone,
        items: orderItems,
        subtotal,
        deliveryMethod,
        deliveryFee,
        deliveryFeeRaw,
        deliverySubsidy,
        distanceMeters,
        deliveryTier,
        deliveryEstimate,
        status: "pending",
        statusHistory: [
          { status: "pending", at: new Date(), note: "Order placed" },
        ],
      });

      itemsTotal = round(itemsTotal + subtotal);
      deliveryTotal = round(deliveryTotal + deliveryFee);
    }

    // 8. Totals. Every figure recomputed here from server-side data - nothing
    //    about money is ever taken from the request body.
    const platformFee = round(
      (itemsTotal * settings.platformFeePercent) / 100,
    );
    const grandTotal = round(itemsTotal + deliveryTotal + platformFee);

    const order = await Order.create({
      orderNumber: await generateOrderNumber(),
      customer: req.user._id,
      customerName: req.user.name,
      customerPhone: req.user.phone,
      deliveryAddress,
      deliveryLocation: { type: "Point", coordinates: customerCoords },
      subOrders,
      itemsTotal,
      deliveryTotal,
      platformFee,
      grandTotal,
      expiresAt: new Date(
        Date.now() + settings.orderTimeoutMinutes * 60 * 1000,
      ),
    });

    // Past this line the stock belongs to a real order. Nothing may release it.
    committed = true;

    res.status(201).json(order);
  } catch (error) {
    // The rollback. Manual compensation: every reservation made before the
    // failure is handed back. Honest limitation - if the process dies between
    // the reservation and this line, that stock stays held until the expiry
    // sweep or an admin clears it. A MongoDB session transaction is the fix.
    if (!committed) {
      await releaseStock(reservations);
    }

    if (error instanceof CheckoutError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error("createOrder error:", error);
    res.status(500).json({ message: "Could not place your order" });
  }
};

// GET /api/orders/my-orders
export const getMyOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const orders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({ count: orders.length, page, orders });
  } catch (error) {
    console.error("getMyOrders error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/orders/shop-orders
export const getShopOrders = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res
        .status(404)
        .json({ message: "You have not registered a shop yet" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // $elemMatch keeps both conditions on the same array element. Without it,
    // { 'subOrders.shop': x, 'subOrders.status': 'packed' } would match an
    // order where a different shop's sub-order is the packed one.
    const elemMatch = { shop: shop._id };
    if (req.query.status) {
      elemMatch.status = req.query.status;
    }

    const orders = await Order.find({
      // Unpaid orders can still expire, so merchants never see them.
      paymentStatus: "paid",
      subOrders: { $elemMatch: elemMatch },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      count: orders.length,
      page,
      orders: orders.map((order) => shapeForShop(order, shop._id)),
    });
  } catch (error) {
    console.error("getShopOrders error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/orders/:id
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (
      order.customer.toString() === req.user._id.toString() ||
      req.user.role === "admin"
    ) {
      return res.status(200).json(order);
    }

    // A merchant may open an order that contains their shop, but only ever
    // sees their own sub-order.
    if (req.user.role === "merchant") {
      const shop = await Shop.findOne({ owner: req.user._id });
      const isInThisOrder =
        shop &&
        order.subOrders.some(
          (sub) => sub.shop.toString() === shop._id.toString(),
        );

      if (isInThisOrder) {
        return res.status(200).json(shapeForShop(order, shop._id));
      }
    }

    res.status(403).json({ message: "You cannot view this order" });
  } catch (error) {
    console.error("getOrderById error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/orders/:id/status
export const updateSubOrderStatus = async (req, res) => {
  try {
    const { status, note, declineReason } = req.body;

    if (!status) {
      return res.status(400).json({ message: "A new status is required" });
    }

    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res
        .status(404)
        .json({ message: "You have not registered a shop yet" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ownership, checked separately from the role. authorize('merchant')
    // proved they are a merchant; this proves this order is theirs.
    const subOrder = order.subOrders.find(
      (sub) => sub.shop.toString() === shop._id.toString(),
    );

    if (!subOrder) {
      return res
        .status(403)
        .json({ message: "This order does not include your shop" });
    }

    if (order.paymentStatus !== "paid") {
      return res
        .status(403)
        .json({ message: "This order has not been paid for yet" });
    }

    const allowed = ALLOWED_TRANSITIONS[subOrder.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `An order cannot move from ${subOrder.status} to ${status}`,
        allowed,
      });
    }

    // The two handover states are not interchangeable - which one applies is
    // decided by how the order is being fulfilled.
    if (status === "out_for_delivery" && subOrder.deliveryMethod !== "delivery") {
      return res
        .status(400)
        .json({ message: "This is a pickup order, mark it ready for pickup" });
    }
    if (status === "ready_for_pickup" && subOrder.deliveryMethod !== "pickup") {
      return res
        .status(400)
        .json({ message: "This is a delivery order, mark it out for delivery" });
    }

    if (status === "declined" || status === "cancelled") {
      if (status === "declined") {
        subOrder.declineReason = declineReason || "No reason given";
      }
      // The customer is not getting these items, so the stock goes back.
      await releaseStock(reservationsFromItems(subOrder.items));
    }

    subOrder.status = status;
    subOrder.statusHistory.push({ status, at: new Date(), note });

    // .save() and not findByIdAndUpdate, so document hooks and validators run.
    await order.save();

    res.status(200).json(shapeForShop(order, shop._id));
  } catch (error) {
    console.error("updateSubOrderStatus error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/orders/:id/cancel
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "This is not your order" });
    }

    // A customer may pull out while a shop has not started work. Once an
    // order is packed it is the merchant's call, not the customer's.
    const cancellable = order.subOrders.filter(
      (sub) => sub.status === "pending" || sub.status === "accepted",
    );

    if (cancellable.length === 0) {
      return res
        .status(400)
        .json({ message: "This order can no longer be cancelled" });
    }

    for (const subOrder of cancellable) {
      await releaseStock(reservationsFromItems(subOrder.items));
      subOrder.status = "cancelled";
      subOrder.statusHistory.push({
        status: "cancelled",
        at: new Date(),
        note: "Cancelled by customer",
      });
    }

    await order.save();

    // Note: money is not touched here. If the order was already paid, the
    // refund is currently a manual Paystack action - see refundOrder in the
    // admin controller.
    res.status(200).json(order);
  } catch (error) {
    console.error("cancelOrder error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export { ALLOWED_TRANSITIONS, HOLDS_STOCK, shapeForShop };
