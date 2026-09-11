import express from 'express';
import { createShop, getNearbyShops, getMyShop, updateMyShop, getShopById } from '../controllers/shopController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import validateObjectId from '../middleware/validateObjectId.js';


const router = express.Router();

// Specific paths first. '/nearby' and '/my-shop' above '/:id', or Express
// matches them as an id.
router.get('/nearby', getNearbyShops);
router.post('/', protect, authorize('merchant'), createShop);
router.get('/my-shop', protect, authorize('merchant'), getMyShop);
router.patch('/my-shop', protect, authorize('merchant'), updateMyShop);
router.get('/:id', validateObjectId(), getShopById);

export default router;
