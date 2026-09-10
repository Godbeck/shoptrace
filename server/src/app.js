import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import shopRouter from './routes/shopRoutes.js';
import productRoutes from './routes/productRoutes.js';

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());


app.get('/', (req,res) => {
    res.json({message: 'ShopTrace API is running'});
});

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRouter);
app.use('/api/products', productRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})