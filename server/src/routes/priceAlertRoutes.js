import express from "express";
import {
  createPriceAlert,
  getMyPriceAlerts,
  deletePriceAlert,
} from "../controllers/priceAlertController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createPriceAlert);
router.get("/", protect, getMyPriceAlerts);
router.delete("/:id", protect, deletePriceAlert);

export default router;
