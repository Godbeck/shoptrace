import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

/**
 * Creates or promotes the first admin.
 *
 * Needed because registration cannot grant the admin role - if it could,
 * anyone could take over the platform. Run it once:
 *
 *   npm run seed:admin -- "Full Name" admin@shoptrace.com 0244000000 secret123
 */
const [name, email, phone, password] = process.argv.slice(2);

if (!name || !email || !phone || !password) {
  console.error(
    'Usage: npm run seed:admin -- "Name" email@example.com 0244000000 password',
  );
  process.exit(1);
}

await connectDB();

const existing = await User.findOne({ email: email.toLowerCase() });

if (existing) {
  existing.role = "admin";
  // Only the role is touched, so the pre('save') password hook stays asleep
  // and the existing login keeps working.
  await existing.save();
  console.log(`Promoted existing user ${existing.email} to admin`);
} else {
  const admin = await User.create({ name, email, phone, password, role: "admin" });
  console.log(`Created admin ${admin.email}`);
}

await mongoose.disconnect();
process.exit(0);
