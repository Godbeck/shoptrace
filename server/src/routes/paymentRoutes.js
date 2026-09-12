import express from "express";
import {
  initiatePayment,
  verifyPayment,
  refundOrder,
  mockPayOrder,
} from "../controllers/paymentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import validateObjectId from "../middleware/validateObjectId.js";

const router = express.Router();

// Note: the webhook is NOT here. It needs the raw request body, so it is
// mounted directly in app.js before the JSON body parser runs.
router.post("/initiate/:orderId", protect, validateObjectId("orderId"), initiatePayment);
router.get("/verify/:reference", protect, verifyPayment);

// Dev-only stand-in while Paystack is not connected. The handler itself
// refuses to run without ALLOW_MOCK_PAYMENTS=true, and always refuses in
// production. Delete this route the day Paystack goes live.
router.post("/mock-pay/:orderId", protect, validateObjectId("orderId"), mockPayOrder);

router.post(
  "/refund/:orderId",
  protect,
  authorize("admin"),
  validateObjectId("orderId"),
  refundOrder,
);

export default router;
