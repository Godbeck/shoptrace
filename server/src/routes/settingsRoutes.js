import express from "express";
import {
  getSettings,
  getPublicSettings,
  updateSettings,
} from "../controllers/settingsController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/public", getPublicSettings);
router.get("/", protect, authorize("admin"), getSettings);
router.patch("/", protect, authorize("admin"), updateSettings);

export default router;
