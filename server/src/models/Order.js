import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    brand: { type: String },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, default: "" },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const subOrderSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  shopName: { type: String, required: true },
  shopPhone: { type: String },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  deliveryMethod: {
    type: String,
    enum: ["delivery", "pickup"],
    required: true,
  },
  deliveryFee: { type: Number, default: 0 },
  deliveryFeeRaw: { type: Number, default: 0 },
  deliverySubsidy: { type: Number, default: 0 },
  distanceMeters: { type: Number },
  deliveryTier: {
    type: String,
    enum: ["neighbourhood", "city", "regional"],
  },
  deliveryEstimate: { type: String },
  status: {
    type: String,
    enum: [
      "pending",
      "accepted",
      "packed",
      "out_for_delivery",
      "ready_for_pickup",
      "completed",
      "declined",
      "cancelled",
    ],
    default: "pending",
  },
  statusHistory: [
    {
      status: String,
      at: { type: Date, default: Date.now },
      note: String,
      _id: false,
    },
  ],
  declineReason: { type: String },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    deliveryAddress: { type: String },
    deliveryLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: { type: [Number] },
    },
    subOrders: [subOrderSchema],
    itemsTotal: { type: Number, required: true },
    deliveryTotal: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded", "partially_refunded"],
      default: "unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["momo", "card", "bank_transfer"],
    },
    paystackReference: { type: String },
    paidAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ "subOrders.shop": 1, "subOrders.status": 1 });
orderSchema.index({ paymentStatus: 1, expiresAt: 1 });

orderSchema.virtual("overallStatus").get(function () {
  const statuses = this.subOrders.map((s) => s.status);

  if (statuses.every((s) => s === "completed")) return "completed";
  if (statuses.every((s) => s === "declined" || s === "cancelled"))
    return "cancelled";
  if (statuses.some((s) => s === "out_for_delivery")) return "on_the_way";
  if (statuses.some((s) => s === "packed" || s === "ready_for_pickup"))
    return "preparing";
  if (statuses.some((s) => s === "accepted")) return "accepted";
  return "pending";
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

const Order = mongoose.model("Order", orderSchema);

export default Order;
