import mongoose from "mongoose";

// A tiny collection whose only job is handing out numbers that never repeat.
// One document per sequence, e.g. { _id: 'orderNumber', seq: 41 }.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

// $inc happens inside MongoDB, so two checkouts landing at the same moment
// get 42 and 43 rather than both reading 41 and both writing 42.
counterSchema.statics.next = async function (name) {
  const counter = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
};

const Counter = mongoose.model("Counter", counterSchema);

export default Counter;
