import express from "express";
import {
  createReview,
  getShopReviews,
  getMyReviews,
  replyToReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import validateObjectId from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/my-reviews", protect, getMyReviews);
router.get("/shop/:shopId", validateObjectId("shopId"), getShopReviews);
router.post("/", protect, createReview);
router.patch(
  "/:id/reply",
  protect,
  authorize("merchant"),
  validateObjectId(),
  replyToReview,
);
router.delete("/:id", protect, validateObjectId(), deleteReview);

export default router;
