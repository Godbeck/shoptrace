import express from "express";
import {
  initiatePayment,
  verifyPayment,
  refundOrder,
} from "../controllers/paymentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Note: the webhook is NOT here. It needs the raw request body, so it is
// mounted directly in app.js before the JSON body parser runs.
router.post("/initiate/:orderId", protect, initiatePayment);
router.get("/verify/:reference", protect, verifyPayment);
router.post("/refund/:orderId", protect, authorize("admin"), refundOrder);

export default router;
