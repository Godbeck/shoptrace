import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    // The order the review is earned by. A review with no completed order
    // behind it is just an opinion from a stranger.
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: [true, "A rating is required"],
      min: [1, "Rating must be between 1 and 5"],
      max: [5, "Rating must be between 1 and 5"],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot be longer than 1000 characters"],
    },
    // Merchants get one public reply, not a comment thread.
    merchantReply: {
      type: String,
      trim: true,
      maxlength: [500, "Reply cannot be longer than 500 characters"],
    },
    merchantRepliedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// One review per shop per order. The database enforces it, so two taps on a
// slow connection cannot create two reviews.
reviewSchema.index({ order: 1, shop: 1 }, { unique: true });
reviewSchema.index({ shop: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
