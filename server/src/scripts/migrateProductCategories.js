/**
 * Moves every product from a single `category` string to a `categories` array.
 *
 * Written with the driver rather than the Mongoose model on purpose: the model
 * no longer declares `category`, so Mongoose would strip the very field this
 * script has to read.
 *
 * Safe to run twice. Products that already have a categories array are skipped,
 * so a half-finished run can simply be run again.
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";

await connectDB();
const products = mongoose.connection.collection("products");

const pending = await products
  .find({ category: { $exists: true }, categories: { $exists: false } })
  .toArray();

console.log(`\n  products to migrate: ${pending.length}`);

let migrated = 0;
for (const p of pending) {
  await products.updateOne(
    { _id: p._id },
    { $set: { categories: [p.category] }, $unset: { category: "" } },
  );
  console.log(`    ${p.name} -> [${p.category}]`);
  migrated++;
}

const leftover = await products.countDocuments({ category: { $exists: true } });
const total = await products.countDocuments();
const withArray = await products.countDocuments({ categories: { $exists: true } });

console.log(`\n  migrated ${migrated}`);
console.log(`  products with the old field: ${leftover}`);
console.log(`  products with categories[]:  ${withArray} of ${total}`);

await mongoose.disconnect();
