import mongoose from "mongoose";
import PriceHistory from "./PriceHistory.js";

const productSchema = new mongoose.Schema(
    {
        shop:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
        },
        shopName: {
            type: String,
            required: true,
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number],
                required: true,
            }
        },
        name: {
            type: String,
            required: [true, 'Product name is required'],
            trim: true,
        },
        brand: {
            type: String,
            trim: true,
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            enum: ['Electronics', 'Fashion', 'Food', 'Home', 'Hardware', 'Other'],
        },
        description: {
            type: String,
            trim: true,
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },
        stockCount: {
            type: Number,
            default: 0,
            min: [0, 'Stock count cannot be negative'],
        },
        inStock: {
            type: Boolean,
            default: true,
        },
        condition: {
            type: String,
            enum: ['Brand new', 'Used', 'Refurbished'],
            default: 'Brand new',
        },
        imageUrls: {
            type: [String],
            default: [],
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        featuredUntil: {
            type: Date,
        },
        viewCount: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        }
    },
    {
        timestamps: true,
    }
);

productSchema.index({location: '2dsphere'});
productSchema.index({name: 'text', brand: 'text', description: 'text' })
productSchema.index({shop: 1, isActive: 1});
productSchema.index({category: 1, price: 1});

// Remember the price as it was loaded from the database, so a later save can
// tell what the price changed from.
productSchema.post('init', function (doc) {
    doc.$locals.persistedPrice = doc.get('price');
});

productSchema.pre('save', function () {
    if (this.isModified('stockCount')) {
        this.inStock = this.stockCount > 0;
    }
});

productSchema.pre('save', function () {
    if (this.isNew) {
        this.$locals.priceChanged = true;
        this.$locals.oldPrice = null;
    } else if (this.isModified('price')) {
        this.$locals.priceChanged = true;
        this.$locals.oldPrice = this.$locals.persistedPrice ?? null;
    }
});

productSchema.post('save', async function (doc) {
    if (!doc.$locals.priceChanged) {
        return;
    }
    await PriceHistory.create({
        product: doc._id,
        shop: doc.shop,
        price: doc.price,
        previousPrice: doc.$locals.oldPrice,
    });
    // Keep the baseline current for any further saves on this same instance.
    doc.$locals.persistedPrice = doc.get('price');
    doc.$locals.priceChanged = false;
});

const Product = mongoose.model('Product', productSchema);

export default Product;