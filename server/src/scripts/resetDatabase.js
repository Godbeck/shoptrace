import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

/**
 * Wipes every document and leaves one admin behind.
 *
 *   npm run db:reset -- --yes
 *
 * The --yes is required on purpose. This is not recoverable, and a script
 * that destroys a database on a bare invocation is a script that will
 * eventually destroy the wrong one.
 *
 * It refuses outright when NODE_ENV is production.
 */

const ADMIN = {
  name: "ShopTrace Admin",
  email: "admin@shoptrace.com",
  phone: "0244000000",
  password: "admin12345",
};

/** Collections emptied. `settings` regenerates itself via Settings.get(). */
const COLLECTIONS = [
  "users",
  "shops",
  "products",
  "pricehistories",
  "pricealerts",
  "orders",
  "reviews",
  "counters",
  "settings",
];

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run against production.");
  process.exit(1);
}

if (!process.argv.includes("--yes")) {
  console.error(
    "This deletes every document in the database and cannot be undone.\n" +
      "Re-run with --yes if that is what you want:\n\n" +
      "  npm run db:reset -- --yes\n",
  );
  process.exit(1);
}

await connectDB();

const db = mongoose.connection.db;
console.log(`\nResetting ${mongoose.connection.name}\n`);

let removed = 0;

for (const name of COLLECTIONS) {
  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) {
    console.log(`  ${name.padEnd(16)} (absent)`);
    continue;
  }

  const before = await db.collection(name).countDocuments();
  await db.collection(name).deleteMany({});
  removed += before;
  console.log(`  ${name.padEnd(16)} ${String(before).padStart(5)} removed`);
}

// Recreated through the model rather than a raw insert, so the pre('save')
// hook hashes the password exactly as a real signup would.
const admin = await User.create({ ...ADMIN, role: "admin" });

console.log(`\n${removed} documents removed.`);
console.log(`Admin recreated: ${admin.email} / ${ADMIN.password}`);
console.log("Order numbers restart at ST-00001.");
console.log("Platform settings regenerate with defaults on first use.\n");

await mongoose.disconnect();
process.exit(0);
