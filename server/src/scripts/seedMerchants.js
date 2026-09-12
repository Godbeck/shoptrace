import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Shop from "../models/Shop.js";
import Product from "../models/Product.js";

dotenv.config();

/**
 * Creates five verified merchants with shops and products, for testing.
 *
 *   npm run seed:merchants
 *
 * Safe to re-run: an email that already exists is skipped rather than
 * duplicated.
 *
 * Three products appear at more than one shop ON PURPOSE - an Infinix phone,
 * an Oraimo power bank, a Binatone fan and Ghacem cement. Without overlap the
 * price comparison, which is the whole point of ShopTrace, has nothing to
 * compare.
 */

const PASSWORD = "merchant123";

const MERCHANTS = [
  {
    owner: { name: "Kwame Asante", email: "osuelectronics@shoptrace.com", phone: "0244118001" },
    shop: {
      name: "Osu Electronics Centre",
      categories: ["Electronics"],
      description: "Phones, laptops and accessories on Oxford Street since 2016.",
      phone: "0244118001",
      address: "18 Oxford Street, Osu, Accra",
      latitude: 5.556,
      longitude: -0.1969,
      openingHours: "Mon - Sat, 8:00am - 7:00pm",
      deliveryRange: "city",
    },
    products: [
      { name: "Infinix Hot 40i", brand: "Infinix", category: "Electronics", price: 1450.5, stockCount: 12, description: "8GB RAM, 256GB storage, 5000mAh battery. Sealed in box with a one-year warranty." },
      { name: "Oraimo 20000mAh power bank", brand: "Oraimo", category: "Electronics", price: 185, stockCount: 30, description: "Fast charge, dual USB output, digital battery display." },
      { name: 'Samsung 43" smart TV', brand: "Samsung", category: "Electronics", price: 3250, stockCount: 4, description: "43 inch, 4K UHD, built-in streaming apps." },
    ],
  },
  {
    owner: { name: "Abena Owusu", email: "circletech@shoptrace.com", phone: "0244118002" },
    shop: {
      name: "Circle Tech Plaza",
      categories: ["Electronics", "Home"],
      description: "Electronics and small appliances at Kwame Nkrumah Circle.",
      phone: "0244118002",
      address: "Kwame Nkrumah Circle, Accra",
      latitude: 5.5705,
      longitude: -0.2103,
      openingHours: "Mon - Sat, 7:30am - 6:30pm",
      deliveryRange: "city",
    },
    products: [
      // Same phone, cheaper than Osu - this is what makes compare interesting.
      { name: "Infinix Hot 40i", brand: "Infinix", category: "Electronics", price: 1399, stockCount: 8, description: "8GB RAM, 256GB storage. Sealed, with warranty card." },
      { name: "Oraimo 20000mAh power bank", brand: "Oraimo", category: "Electronics", price: 199, stockCount: 15, description: "Fast charge power bank with digital display." },
      { name: 'Binatone 16" standing fan', brand: "Binatone", category: "Home", price: 349, stockCount: 10, description: "Three speed settings, adjustable height, wide oscillation." },
    ],
  },
  {
    owner: { name: "Yaw Mensah", email: "adumhardware@shoptrace.com", phone: "0244118003" },
    shop: {
      name: "Adum Hardware Depot",
      categories: ["Hardware"],
      description: "Cement, roofing and building tools in Adum.",
      phone: "0244118003",
      address: "Adum Market, Kumasi",
      latitude: 6.6885,
      longitude: -1.6244,
      openingHours: "Mon - Sat, 7:00am - 6:00pm",
      deliveryRange: "area",
    },
    products: [
      { name: "Ghacem Super Rapid cement 50kg", brand: "Ghacem", category: "Hardware", price: 95, stockCount: 200, description: "50kg bag, Super Rapid grade, suitable for structural work." },
      { name: "Aluminium roofing sheet 3m", brand: "Domod", category: "Hardware", price: 180, stockCount: 60, description: "3 metre corrugated aluminium sheet, 0.45mm gauge." },
      { name: "Heavy duty wheelbarrow", brand: "Jumbo", category: "Hardware", price: 420, stockCount: 12, description: "Reinforced steel tray with pneumatic tyre." },
    ],
  },
  {
    owner: { name: "Akosua Darko", email: "kantamantostyles@shoptrace.com", phone: "0244118004" },
    shop: {
      name: "Kantamanto Styles",
      categories: ["Fashion"],
      description: "Ready-to-wear and tailored pieces from Kantamanto.",
      phone: "0244118004",
      address: "Kantamanto Market, Accra Central",
      latitude: 5.5478,
      longitude: -0.2103,
      openingHours: "Mon - Sat, 8:00am - 6:00pm",
      deliveryRange: "city",
    },
    products: [
      { name: "Ankara two-piece set", brand: "Kantamanto Studio", category: "Fashion", price: 260, stockCount: 14, description: "Wax print top and skirt, tailored to order in three days." },
      { name: "Men's slim fit shirt", brand: "Accra Threads", category: "Fashion", price: 120, stockCount: 25, description: "Cotton blend, long sleeve, available in four colours." },
      { name: "Handmade leather sandals", brand: "Kumasi Leather", category: "Fashion", price: 180, stockCount: 20, description: "Full grain leather, hand stitched, sizes 39 to 46." },
    ],
  },
  {
    owner: { name: "Kojo Anane", email: "temahome@shoptrace.com", phone: "0244118005" },
    shop: {
      name: "Tema Home & Living",
      categories: ["Home", "Hardware"],
      description: "Appliances, fittings and building supplies in Community 1.",
      phone: "0244118005",
      address: "Community 1, Tema",
      latitude: 5.6698,
      longitude: -0.0166,
      openingHours: "Mon - Sat, 8:00am - 6:00pm",
      deliveryRange: "city",
    },
    products: [
      // Cheapest fan of the three shops carrying it.
      { name: 'Binatone 16" standing fan', brand: "Binatone", category: "Home", price: 320, stockCount: 6, description: "Three speed settings with wide oscillation." },
      { name: "Century 30L water heater", brand: "Century", category: "Home", price: 890, stockCount: 5, description: "30 litre storage heater, thermostat controlled." },
      { name: "Ghacem Super Rapid cement 50kg", brand: "Ghacem", category: "Hardware", price: 102, stockCount: 150, description: "50kg bag, Super Rapid grade." },
    ],
  },
];

await connectDB();

console.log(`\nSeeding ${MERCHANTS.length} merchants\n`);

let created = 0;
let skipped = 0;

for (const entry of MERCHANTS) {
  const existing = await User.findOne({ email: entry.owner.email.toLowerCase() });

  if (existing) {
    console.log(`  ${entry.shop.name.padEnd(24)} already exists, skipped`);
    skipped += 1;
    continue;
  }

  // Through the model, so the pre('save') hook hashes the password exactly
  // as a real signup would.
  const owner = await User.create({
    ...entry.owner,
    password: PASSWORD,
    role: "merchant",
  });

  const shop = await Shop.create({
    owner: owner._id,
    ...entry.shop,
    location: {
      type: "Point",
      coordinates: [entry.shop.longitude, entry.shop.latitude],
    },
    // Seeded shops arrive verified - the approval flow is worth testing once,
    // not five times.
    status: "verified",
    verifiedAt: new Date(),
  });

  for (const product of entry.products) {
    await Product.create({
      shop: shop._id,
      shopName: shop.name,
      location: shop.location,
      condition: "Brand new",
      stockConfirmedAt: new Date(),
      ...product,
    });
  }

  console.log(
    `  ${entry.shop.name.padEnd(24)} ${entry.shop.categories.join(", ").padEnd(20)} ${entry.products.length} products`,
  );
  created += 1;
}

console.log(`\n${created} created, ${skipped} skipped.\n`);

if (created > 0) {
  console.log("Sign in with any of these:\n");
  for (const m of MERCHANTS) {
    console.log(`  ${m.owner.email.padEnd(36)} ${m.shop.name}`);
  }
  console.log(`\nPassword for all of them: ${PASSWORD}\n`);
}

await mongoose.disconnect();
process.exit(0);
