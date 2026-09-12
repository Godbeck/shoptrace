import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";

dotenv.config();

/**
 * Moves existing shops from a single `category` to a `categories` list.
 *
 * Run once after the schema change:
 *   npm run db:migrate-categories
 *
 * Written against the raw collection rather than the model, because the model
 * no longer knows the old field exists - Mongoose would strip it before this
 * code ever saw it.
 */
await connectDB();

const shops = mongoose.connection.db.collection("shops");

const stale = await shops
  .find({ category: { $exists: true } })
  .project({ name: 1, category: 1, categories: 1 })
  .toArray();

if (stale.length === 0) {
  console.log("\nNothing to migrate - no shop still has the old field.\n");
} else {
  console.log(`\nMigrating ${stale.length} shop(s)\n`);

  for (const shop of stale) {
    // Keep whatever is already in categories, add the old value if missing.
    const next = new Set(shop.categories ?? []);
    if (shop.category) next.add(shop.category);

    await shops.updateOne(
      { _id: shop._id },
      { $set: { categories: [...next] }, $unset: { category: "" } },
    );

    console.log(`  ${String(shop.name).padEnd(24)} ${shop.category} -> [${[...next].join(", ")}]`);
  }
  console.log("");
}

// Food is gone from the enum, so anything still on it would fail validation
// the next time that document is saved.
const food = await shops.countDocuments({ categories: "Food" });
const foodProducts = await mongoose.connection.db
  .collection("products")
  .countDocuments({ category: "Food" });

if (food || foodProducts) {
  console.log(`Food is no longer a category. Moving to "Other":`);
  await shops.updateMany({ categories: "Food" }, { $set: { "categories.$": "Other" } });
  await mongoose.connection.db
    .collection("products")
    .updateMany({ category: "Food" }, { $set: { category: "Other" } });
  console.log(`  ${food} shop(s), ${foodProducts} product(s)\n`);
}

await mongoose.disconnect();
process.exit(0);
