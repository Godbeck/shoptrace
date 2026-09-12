import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import merchantRoutes from './routes/merchantRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import priceAlertRoutes from './routes/priceAlertRoutes.js';
import { paystackWebhook } from './controllers/paymentController.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();
connectDB();

const app = express();

app.use(cors());

/**
 * The webhook is mounted HERE, above express.json(), and it is the only route
 * that gets express.raw().
 *
 * Paystack signs the exact bytes it sent. Once express.json() has parsed the
 * body into an object, those original bytes are gone - re-serialising them
 * produces different bytes (key order, spacing) and the signature check would
 * fail every single time. So this route keeps the body as a Buffer.
 */
app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    paystackWebhook,
);

// Everything below this line receives a parsed JSON body as normal.
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'ShopTrace API is running' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/price-alerts', priceAlertRoutes);

// These two go last. Express runs middleware in order, so a 404 handler
// declared above the routes would swallow every request.
app.use(notFound);
app.use(errorHandler);

// 4000, matching .env and the rest of the docs.
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})
