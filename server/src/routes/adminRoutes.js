import express from "express";
import {
  getShops,
  verifyShop,
  suspendShop,
  setShopSubscription,
  featureShop,
  getUsers,
  updateUserRole,
  getAllOrders,
  getPlatformStats,
  runExpirySweep,
  queueShopNameSync,
} from "../controllers/adminController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import validateObjectId from "../middleware/validateObjectId.js";

const router = express.Router();

// Every route below is admin-only, so the guard is applied once to the whole
// router instead of being repeated on each line.
router.use(protect, authorize("admin"));

router.get("/stats", getPlatformStats);

router.get("/shops", getShops);
router.patch("/shops/:id/verify", validateObjectId(), verifyShop);
router.patch("/shops/:id/suspend", validateObjectId(), suspendShop);
router.patch("/shops/:id/subscription", validateObjectId(), setShopSubscription);
router.patch("/shops/:id/feature", validateObjectId(), featureShop);

router.get("/users", getUsers);
router.patch("/users/:id/role", validateObjectId(), updateUserRole);

router.get("/orders", getAllOrders);

router.post("/jobs/expire-orders", runExpirySweep);
router.post("/jobs/sync-shop-name/:id", validateObjectId(), queueShopNameSync);

export default router;
