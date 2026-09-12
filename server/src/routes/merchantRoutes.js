import express from "express";
import { getShopSummary } from "../controllers/merchantController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Everything here is scoped to the requester's own shop, so the whole router
// is merchant-only and no route takes a shop id.
router.use(protect, authorize("merchant"));

router.get("/summary", getShopSummary);

export default router;
