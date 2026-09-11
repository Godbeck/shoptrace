import express from "express";
import {
  createPriceAlert,
  getMyPriceAlerts,
  deletePriceAlert,
} from "../controllers/priceAlertController.js";
import { protect } from "../middleware/authMiddleware.js";
import validateObjectId from "../middleware/validateObjectId.js";

const router = express.Router();

router.post("/", protect, createPriceAlert);
router.get("/", protect, getMyPriceAlerts);
router.delete("/:id", protect, validateObjectId(), deletePriceAlert);

export default router;
