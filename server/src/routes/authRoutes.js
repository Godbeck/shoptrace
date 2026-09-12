import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController.js';
import {
    updateMe,
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    getPaymentMethods,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
} from '../controllers/profileController.js';
import { protect } from '../middleware/authMiddleware.js';
import validateObjectId from '../middleware/validateObjectId.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);

// Saved delivery addresses. There is no :userId in any of these paths - a
// user can only ever edit their own.
router.get('/me/addresses', protect, getAddresses);
router.post('/me/addresses', protect, addAddress);
router.patch('/me/addresses/:addressId', protect, validateObjectId('addressId'), updateAddress);
router.delete('/me/addresses/:addressId', protect, validateObjectId('addressId'), deleteAddress);

// Saved mobile money numbers.
router.get('/me/payment-methods', protect, getPaymentMethods);
router.post('/me/payment-methods', protect, addPaymentMethod);
router.patch('/me/payment-methods/:methodId', protect, validateObjectId('methodId'), updatePaymentMethod);
router.delete('/me/payment-methods/:methodId', protect, validateObjectId('methodId'), deletePaymentMethod);

export default router;
