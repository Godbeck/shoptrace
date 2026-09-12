import express from 'express';
import {   
createProduct,
  searchProducts,
  getProductById,
  getMyProducts,
  updateProduct,
  deleteProduct,
  getPriceHistory,
  compareProduct,
  confirmStock,
  getStaleStock,
} from '../controllers/productController.js';
import {protect, authorize} from '../middleware/authMiddleware.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = express.Router();


router.get('/search', searchProducts);
router.get('/my-products', protect, authorize('merchant'), getMyProducts);
// Products whose stock the merchant has not vouched for lately.
router.get('/stale', protect, authorize('merchant'), getStaleStock);
router.post('/', protect, authorize('merchant'), createProduct);
router.get('/:id/price-history', validateObjectId(), getPriceHistory);
// Every shop selling this same product, cheapest first.
router.get('/:id/compare', validateObjectId(), compareProduct);
router.get('/:id', validateObjectId(), getProductById);
// One tap: "this count is still right".
router.patch('/:id/confirm-stock', protect, authorize('merchant'), validateObjectId(), confirmStock);
router.patch('/:id', protect, authorize('merchant'), validateObjectId(), updateProduct);
router.delete('/:id', protect, authorize('merchant'), validateObjectId(), deleteProduct);

export default router;
