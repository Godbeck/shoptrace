import mongoose from "mongoose";

const priceAlertSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // "Tell me when this drops to GH 1,200 or below."
    targetPrice: {
      type: Number,
      required: [true, "A target price is required"],
      min: [0, "Target price cannot be negative"],
    },
    // The price when the alert was created, so the notification can say
    // how much it has actually come down by.
    priceWhenSet: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastNotifiedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// One alert per customer per product - resetting the target updates the
// existing alert rather than stacking a second one.
priceAlertSchema.index({ customer: 1, product: 1 }, { unique: true });
// The query the price-alert job runs.
priceAlertSchema.index({ product: 1, isActive: 1 });

const PriceAlert = mongoose.model("PriceAlert", priceAlertSchema);

export default PriceAlert;
