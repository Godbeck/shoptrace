import express from "express";
import {
  createOrder,
  getMyOrders,
  getShopOrders,
  getOrderById,
  updateSubOrderStatus,
  cancelOrder,
} from "../controllers/orderController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import validateObjectId from "../middleware/validateObjectId.js";

const router = express.Router();

// Specific paths before the parameterised one, or Express reads
// "my-orders" as an :id.
router.post("/", protect, createOrder);
router.get("/my-orders", protect, getMyOrders);
router.get("/shop-orders", protect, authorize("merchant"), getShopOrders);
router.get("/:id", protect, validateObjectId(), getOrderById);
router.patch(
  "/:id/status",
  protect,
  authorize("merchant"),
  validateObjectId(),
  updateSubOrderStatus,
);
router.patch("/:id/cancel", protect, validateObjectId(), cancelOrder);

export default router;
