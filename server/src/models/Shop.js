import mongoose from "mongoose";
import { CATEGORIES } from "../utils/categories.js";

const shopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Shop name is required"],
      trim: true,
    },
    /**
     * A shop can sell across several categories - a hardware shop that also
     * stocks fans is normal, and forcing it to pick one made it invisible in
     * half the searches it belonged in.
     *
     * Products still carry exactly ONE category each. This is about the shop,
     * not the item.
     */
    categories: {
      type: [String],
      required: [true, "Pick at least one category"],
      enum: {
        values: CATEGORIES,
        message: "{VALUE} is not a category ShopTrace supports",
      },
      validate: {
        validator: (list) => Array.isArray(list) && list.length > 0,
        message: "Pick at least one category",
      },
    },
    description: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Shop phone number is required"],
    },
    address: {
      type: String,
      required: [true, "Shop address is required"],
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: [true, "Coordinates are required"],
      },
    },
    logoUrl: {
      type: String,
      default: "",
    },
    openingHours: {
      type: String,
      default: "Mon - Sat, 8:00am - 6:00pm",
    },
    status: {
      type: String,
      enum: ["pending", "verified", "suspended"],
      default: "pending",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    subscriptionTier: {
      type: String,
      enum: ["free", "growth", "pro"],
      default: "free",
    },
    subscriptionExpiresAt: {
      type: Date,
    },
    // The merchant's only delivery choice. The kilometre value each word
    // maps to is platform-controlled - see getRangeMaxDistance. There is
    // deliberately no deliveryFee field here: merchants never set fees.
    deliveryRange: {
      type: String,
      enum: ["none", "area", "city", "nationwide"],
      default: "none",
    },
    /**
     * Fulfilment history, used to decide how much to trust this shop's stock.
     *
     * Counters rather than an aggregation, because a search page showing 50
     * products would otherwise need 50 aggregations to render a badge.
     */
    fulfilledCount: {
      type: Number,
      default: 0,
    },
    declinedCount: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    verifiedAt: {
      type: Date,
    },
    suspendedAt: {
      type: Date,
    },
    suspensionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

shopSchema.index({ location: "2dsphere" });
// Multikey index - MongoDB indexes each entry of the array, so a query for
// one category still hits it.
shopSchema.index({ status: 1, categories: 1 });
shopSchema.index({ averageRating: -1 });

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
