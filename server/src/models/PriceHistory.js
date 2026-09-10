import mongoose from "mongoose";

const priceHistorySchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        shop: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },
        previousPrice: {
            type: Number,
        },
    },
    {timestamps: true}
);

priceHistorySchema.index({ product: 1, createdAt: -1 });

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

export default PriceHistory;