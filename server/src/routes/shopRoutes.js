import express from 'express';
import { createShop, getNearbyShops, getMyShop, getShopById} from '../controllers/shopController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';


const router = express.Router();

router.get('/nearby', getNearbyShops);
router.post('/', protect, authorize('merchant'), createShop);
router.get('/my-shop', protect, authorize('merchant'), getMyShop);
router.get('/:id', getShopById);

export default router;