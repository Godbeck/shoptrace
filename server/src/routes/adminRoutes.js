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

const router = express.Router();

// Every route below is admin-only, so the guard is applied once to the whole
// router instead of being repeated on each line.
router.use(protect, authorize("admin"));

router.get("/stats", getPlatformStats);

router.get("/shops", getShops);
router.patch("/shops/:id/verify", verifyShop);
router.patch("/shops/:id/suspend", suspendShop);
router.patch("/shops/:id/subscription", setShopSubscription);
router.patch("/shops/:id/feature", featureShop);

router.get("/users", getUsers);
router.patch("/users/:id/role", updateUserRole);

router.get("/orders", getAllOrders);

router.post("/jobs/expire-orders", runExpirySweep);
router.post("/jobs/sync-shop-name/:id", queueShopNameSync);

export default router;
