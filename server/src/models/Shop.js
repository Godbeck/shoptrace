import mongoose from "mongoose";

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
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Electronics", "Fashion", "Food", "Home", "Hardware", "Other"],
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
    offersDelivery: {
      type: Boolean,
      default: false,
    },
    deliveryFee: {
      type: Number,
      default: 0,
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
    deliveryRange: {
      type: String,
      enum: ["none", "area", "city", "nationwide"],
      default: "none",
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
shopSchema.index({ status: 1, category: 1 });
shopSchema.index({ averageRating: -1 });

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
