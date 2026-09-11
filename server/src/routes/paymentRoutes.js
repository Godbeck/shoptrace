import express from "express";
import {
  initiatePayment,
  verifyPayment,
  refundOrder,
} from "../controllers/paymentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import validateObjectId from "../middleware/validateObjectId.js";

const router = express.Router();

// Note: the webhook is NOT here. It needs the raw request body, so it is
// mounted directly in app.js before the JSON body parser runs.
router.post("/initiate/:orderId", protect, validateObjectId("orderId"), initiatePayment);
router.get("/verify/:reference", protect, verifyPayment);
router.post(
  "/refund/:orderId",
  protect,
  authorize("admin"),
  validateObjectId("orderId"),
  refundOrder,
);

export default router;
