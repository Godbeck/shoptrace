import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "platform",
    },
    delivery: {
      baseFee: { type: Number, default: 10 },
      perKmRate: { type: Number, default: 2.5 },
      neighbourhoodRadius: { type: Number, default: 8000 },
      cityRadius: { type: Number, default: 35000 },
      freeDelivery: {
        enabled: { type: Boolean, default: false },
        minOrderValue: { type: Number, default: 500 },
        maxDistance: { type: Number, default: 8000 },
        maxSubsidy: { type: Number, default: 25 },
        maxSubsidyPerOrder: { type: Number, default: 40 },
        startsAt: { type: Date },
        endsAt: { type: Date },
      },
    },
    platformFeePercent: {
      type: Number,
      default: 0,
    },
    orderTimeoutMinutes: {
      type: Number,
      default: 30,
    },
    subscriptionTiers: {
      free: {
        productLimit: { type: Number, default: 10 },
        price: { type: Number, default: 0 },
      },
      growth: {
        productLimit: { type: Number, default: 500 },
        price: { type: Number, default: 60 },
      },
      pro: {
        productLimit: { type: Number, default: 5000 },
        price: { type: Number, default: 150 },
      },
    },
    featuredListingWeeklyPrice: {
      type: Number,
      default: 15,
    },
  },
  { timestamps: true },
);

settingsSchema.statics.get = async function () {
  let settings = await this.findOne({ key: "platform" });
  if (!settings) {
    settings = await this.create({ key: "platform" });
  }
  return settings;
};

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;
