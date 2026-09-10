import express from "express";
import {
  createReview,
  getShopReviews,
  getMyReviews,
  replyToReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/my-reviews", protect, getMyReviews);
router.get("/shop/:shopId", getShopReviews);
router.post("/", protect, createReview);
router.patch("/:id/reply", protect, authorize("merchant"), replyToReview);
router.delete("/:id", protect, deleteReview);

export default router;
