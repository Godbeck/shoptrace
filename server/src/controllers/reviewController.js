import mongoose from "mongoose";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
import Shop from "../models/Shop.js";
import { sendError } from "../utils/apiError.js";

/**
 * Recalculate a shop's rating summary from its reviews and store the result.
 *
 * Shop.averageRating is denormalised on purpose: a search page showing 50
 * shops would otherwise need 50 aggregations. The cost is this function -
 * it has to be called every time a review changes.
 */
const recalculateShopRating = async (shopId) => {
  const [summary] = await Review.aggregate([
    { $match: { shop: new mongoose.Types.ObjectId(shopId) } },
    {
      $group: {
        _id: "$shop",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  await Shop.findByIdAndUpdate(shopId, {
    averageRating: summary
      ? Math.round(summary.averageRating * 10) / 10
      : 0,
    reviewCount: summary ? summary.reviewCount : 0,
  });
};

// POST /api/reviews
export const createReview = async (req, res) => {
  try {
    const { orderId, shopId, rating, comment } = req.body;

    if (!orderId || !shopId || rating === undefined) {
      return res
        .status(400)
        .json({ message: "Order, shop and rating are required" });
    }

    // Checked here rather than left to the schema, so the message names the
    // real range and the status is a 400 before any lookup happens.
    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be a whole number from 1 to 5" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Gate 1: it has to be your order.
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "This is not your order" });
    }

    // Gate 2: the shop has to be in it.
    const subOrder = order.subOrders.find(
      (sub) => sub.shop.toString() === shopId.toString(),
    );
    if (!subOrder) {
      return res
        .status(400)
        .json({ message: "That shop was not part of this order" });
    }

    // Gate 3: it has to have actually happened. This is what separates a
    // review from an opinion - no completed delivery, no review.
    if (subOrder.status !== "completed") {
      return res.status(403).json({
        message: "You can review a shop once your order from them is complete",
      });
    }

    const review = await Review.create({
      customer: req.user._id,
      customerName: req.user.name,
      shop: shopId,
      order: orderId,
      rating: stars,
      comment,
    });

    await recalculateShopRating(shopId);

    res.status(201).json(review);
  } catch (error) {
    // The unique index on { order, shop } surfaces here.
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "You have already reviewed this shop for this order" });
    }
    return sendError(res, error, "createReview error:");
  }
};

// GET /api/reviews/shop/:shopId
export const getShopReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const [reviews, total] = await Promise.all([
      Review.find({ shop: req.params.shopId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        // Only the display name is exposed, never the reviewer's contact details.
        .select("-customer"),
      Review.countDocuments({ shop: req.params.shopId }),
    ]);

    res.status(200).json({ count: reviews.length, total, page, reviews });
  } catch (error) {
    return sendError(res, error, "getShopReviews error:");
  }
};

// GET /api/reviews/my-reviews
export const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ customer: req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({ count: reviews.length, reviews });
  } catch (error) {
    return sendError(res, error, "getMyReviews error:");
  }
};

// PATCH /api/reviews/:id/reply  (merchant)
export const replyToReview = async (req, res) => {
  try {
    const { reply } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({ message: "A reply is required" });
    }

    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.shop.toString() !== shop._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only reply to reviews of your own shop" });
    }

    review.merchantReply = reply.trim();
    review.merchantRepliedAt = new Date();
    await review.save();

    res.status(200).json(review);
  } catch (error) {
    return sendError(res, error, "replyToReview error:");
  }
};

// DELETE /api/reviews/:id  (author or admin)
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const isAuthor = review.customer.toString() === req.user._id.toString();
    if (!isAuthor && req.user.role !== "admin") {
      return res.status(403).json({ message: "You cannot delete this review" });
    }

    const shopId = review.shop;
    await review.deleteOne();
    // The summary is now wrong until it is recalculated.
    await recalculateShopRating(shopId);

    res.status(200).json({ message: "Review removed" });
  } catch (error) {
    return sendError(res, error, "deleteReview error:");
  }
};

export { recalculateShopRating };
