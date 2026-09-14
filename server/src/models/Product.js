import mongoose from "mongoose";
import PriceHistory from "./PriceHistory.js";
import { CATEGORIES } from "../utils/categories.js";
import { enqueueQuietly, JOBS } from "../jobs/queue.js";

/**
 * One buyable combination of a product: "blue, size 45".
 *
 * Stock lives HERE when a product has variants, because that is the question
 * a customer actually asks - not "how many shoes" but "how many size 45".
 * The product-level stockCount becomes the sum, kept in step by the pre-save
 * hook below and by the aggregation pipeline in utils/stock.js.
 *
 * `price` is optional and falls back to the product price. Size 45 often
 * costs more than size 40, but forcing a merchant to retype the same price
 * into every row of a grid on a phone guarantees mistakes.
 */
const variantSchema = new mongoose.Schema(
    {
        // Both are free text, not enums. The form suggests sizes per
        // category, but a market sells "Size 45 Wide" and "Chale Blue" and a
        // closed list would simply block the listing.
        color: { type: String, trim: true, default: "", maxlength: 40 },
        size: { type: String, trim: true, default: "", maxlength: 40 },
        stockCount: { type: Number, default: 0, min: [0, "Stock cannot be negative"] },
        // Undefined means "use the product price". Deliberately not defaulted
        // to the product price, or a later price change would silently skip
        // every variant that had been saved.
        price: { type: Number, min: [0, "Price cannot be negative"] },
    },
    { _id: true },
);
const productSchema = new mongoose.Schema(
    {
        shop:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
        },
        /**
         * Empty for a product that does not vary - a bag of cement is a bag
         * of cement. Those keep using stockCount directly, exactly as before,
         * so nothing that works today changes.
         */
        variants: {
            type: [variantSchema],
            default: [],
            validate: {
                validator: (v) => v.length <= 60,
                message: "A product can have at most 60 variants",
            },
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
        /**
         * A product can sit in several categories. A pair of running shoes is
         * genuinely Shoes AND Sports & Outdoors, and forcing one made it
         * invisible in half the searches it belonged in - the same reason a
         * shop carries several.
         *
         * The FIRST is treated as primary wherever a single value is needed:
         * the icon on a card, the label on a chip. Order is the merchant's.
         */
        categories: {
            type: [String],
            required: [true, 'Pick at least one category'],
            enum: {
                values: CATEGORIES,
                message: '{VALUE} is not a category ShopTrace supports',
            },
            validate: {
                validator: (list) => Array.isArray(list) && list.length > 0,
                message: 'Pick at least one category',
            },
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
        /**
         * When the MERCHANT last vouched for this number - not when the
         * system last changed it.
         *
         * That distinction is the whole point. A platform sale decrements
         * stock accurately, so it proves nothing about whether the merchant
         * also sold three over the counter this morning. Only a human saying
         * "yes, this is right" refreshes confidence, so only that updates
         * this field.
         */
        stockConfirmedAt: {
            type: Date,
            default: Date.now,
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
// Multikey: MongoDB indexes every element of the array, so a query for one
// category still uses this index.
productSchema.index({categories: 1, price: 1});

// Remember the price as it was loaded from the database, so a later save can
// tell what the price changed from.
productSchema.post('init', function (doc) {
    doc.$locals.persistedPrice = doc.get('price');
});

productSchema.pre('save', function () {
    // With variants, the product's stockCount is a DERIVED total, never typed
    // in. Recomputing it here means one number to trust: every screen that
    // already reads stockCount keeps working without knowing variants exist.
    if (this.variants?.length) {
        this.stockCount = this.variants.reduce(
            (total, v) => total + (v.stockCount || 0),
            0,
        );
    }

    if (this.isModified('stockCount') || this.isModified('variants')) {
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
    const oldPrice = doc.$locals.oldPrice;

    await PriceHistory.create({
        product: doc._id,
        shop: doc.shop,
        price: doc.price,
        previousPrice: oldPrice,
    });

    // A drop, specifically - nobody set an alert hoping for a price rise.
    // enqueueQuietly and not await: a queue that is down must never stop a
    // merchant from saving a price.
    if (oldPrice !== null && oldPrice !== undefined && doc.price < oldPrice) {
        enqueueQuietly(JOBS.CHECK_PRICE_ALERTS, {
            productId: doc._id.toString(),
            price: doc.price,
        });
    }

    // Keep the baseline current for any further saves on this same instance.
    doc.$locals.persistedPrice = doc.get('price');
    doc.$locals.priceChanged = false;
});

const Product = mongoose.model('Product', productSchema);

export default Product;