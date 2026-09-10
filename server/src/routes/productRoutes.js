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

const router = express.Router();


router.get('/search', searchProducts);
router.get('/my-products', protect, authorize('merchant'), getMyProducts);
router.post('/', protect, authorize('merchant'), createProduct);
router.get('/:id/price-history', getPriceHistory);
router.get('/:id', getProductById);
router.patch('/:id', protect, authorize('merchant'), updateProduct);
router.delete('/:id', protect, authorize('merchant'), deleteProduct);

export default router;
