import express from 'express';
import {   
createProduct,
  searchProducts,
  getProductById,
  getMyProducts,
  updateProduct,
  deleteProduct,
  getPriceHistory,
} from '../controllers/productController.js';
import {protect, authorize} from '../middleware/authMiddleware.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = express.Router();


router.get('/search', searchProducts);
router.get('/my-products', protect, authorize('merchant'), getMyProducts);
router.post('/', protect, authorize('merchant'), createProduct);
router.get('/:id/price-history', validateObjectId(), getPriceHistory);
router.get('/:id', validateObjectId(), getProductById);
router.patch('/:id', protect, authorize('merchant'), validateObjectId(), updateProduct);
router.delete('/:id', protect, authorize('merchant'), validateObjectId(), deleteProduct);

export default router;
