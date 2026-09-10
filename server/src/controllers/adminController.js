import User from "../models/User.js";
import Shop from "../models/Shop.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Settings from "../models/Settings.js";
import { expireOrders } from "../utils/expireOrders.js";
import { enqueue, JOBS } from "../jobs/queue.js";

// GET /api/admin/shops?status=pending
export const getShops = async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: "i" };

    const [shops, total] = await Promise.all([
      Shop.find(filter)
        .populate("owner", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Shop.countDocuments(filter),
    ]);

    res.status(200).json({ count: shops.length, total, page, shops });
  } catch (error) {
    console.error("getShops error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/shops/:id/verify
export const verifyShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    if (shop.status === "verified") {
      return res.status(409).json({ message: "This shop is already verified" });
    }

    shop.status = "verified";
    shop.verifiedAt = new Date();
    // A reinstated shop should not keep an old suspension note hanging around.
    shop.suspendedAt = undefined;
    shop.suspensionReason = undefined;

    await shop.save();

    res.status(200).json({ message: "Shop verified", shop });
  } catch (error) {
    console.error("verifyShop error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/shops/:id/suspend
export const suspendShop = async (req, res) => {
  try {
    const { reason } = req.body;

    // Required on purpose. Three weeks later nobody remembers why.
    if (!reason || !reason.trim()) {
      return res
        .status(400)
        .json({ message: "A suspension reason is required" });
    }

    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    shop.status = "suspended";
    shop.suspendedAt = new Date();
    shop.suspensionReason = reason.trim();
    await shop.save();

    res.status(200).json({ message: "Shop suspended", shop });
  } catch (error) {
    console.error("suspendShop error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/shops/:id/subscription
export const setShopSubscription = async (req, res) => {
  try {
    const { tier, months } = req.body;
    const settings = await Settings.get();

    if (!["free", "growth", "pro"].includes(tier)) {
      return res
        .status(400)
        .json({ message: "Tier must be free, growth or pro" });
    }

    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    shop.subscriptionTier = tier;

    if (tier === "free") {
      shop.subscriptionExpiresAt = undefined;
    } else {
      const monthsToAdd = parseInt(months) || 1;
      const start =
        shop.subscriptionExpiresAt && shop.subscriptionExpiresAt > new Date()
          ? new Date(shop.subscriptionExpiresAt)
          : new Date();
      start.setMonth(start.getMonth() + monthsToAdd);
      shop.subscriptionExpiresAt = start;
    }

    await shop.save();

    res.status(200).json({
      message: `Shop moved to the ${tier} tier`,
      shop,
      productLimit: settings.subscriptionTiers[tier].productLimit,
    });
  } catch (error) {
    console.error("setShopSubscription error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/shops/:id/feature
export const featureShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    shop.isFeatured = Boolean(req.body.isFeatured);
    await shop.save();

    res.status(200).json({ message: "Shop updated", shop });
  } catch (error) {
    console.error("featureShop error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/users?role=merchant
export const getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      // .select('-password') and not a raw find - the hash never leaves here.
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({ count: users.length, total, page, users });
  } catch (error) {
    console.error("getUsers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/users/:id/role
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!["customer", "merchant", "admin"].includes(role)) {
      return res
        .status(400)
        .json({ message: "Role must be customer, merchant or admin" });
    }

    // An admin removing their own admin rights locks the platform out.
    if (req.params.id === req.user._id.toString() && role !== "admin") {
      return res
        .status(400)
        .json({ message: "You cannot remove your own admin role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = role;
    // The pre('save') hook is guarded on isModified('password'), so saving
    // here does not re-hash and break the login.
    await user.save();

    res.status(200).json({
      message: `Role updated to ${role}`,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("updateUserRole error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/orders
export const getAllOrders = async (req, res) => {
  try {
    const { paymentStatus } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const filter = {};
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({ count: orders.length, total, page, orders });
  } catch (error) {
    console.error("getAllOrders error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/stats
export const getPlatformStats = async (req, res) => {
  try {
    const [
      customers,
      merchants,
      shopsPending,
      shopsVerified,
      shopsSuspended,
      activeProducts,
      revenue,
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "merchant" }),
      Shop.countDocuments({ status: "pending" }),
      Shop.countDocuments({ status: "verified" }),
      Shop.countDocuments({ status: "suspended" }),
      Product.countDocuments({ isActive: true }),
      // Only paid orders count as revenue. Unpaid ones may still expire.
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            grossValue: { $sum: "$grandTotal" },
            platformFees: { $sum: "$platformFee" },
            deliverySubsidy: { $sum: { $sum: "$subOrders.deliverySubsidy" } },
          },
        },
      ]),
    ]);

    const totals = revenue[0] || {
      orders: 0,
      grossValue: 0,
      platformFees: 0,
      deliverySubsidy: 0,
    };

    res.status(200).json({
      users: { customers, merchants, total: customers + merchants },
      shops: {
        pending: shopsPending,
        verified: shopsVerified,
        suspended: shopsSuspended,
      },
      products: { active: activeProducts },
      orders: {
        paid: totals.orders,
        grossValue: Math.round(totals.grossValue * 100) / 100,
        platformFees: Math.round(totals.platformFees * 100) / 100,
        deliverySubsidyPaid: Math.round(totals.deliverySubsidy * 100) / 100,
      },
    });
  } catch (error) {
    console.error("getPlatformStats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/admin/jobs/expire-orders
 *
 * The same sweep the scheduled job runs, triggered by hand. This exists so the
 * expiry path can be proved without Redis running.
 */
export const runExpirySweep = async (req, res) => {
  try {
    const result = await expireOrders();
    res.status(200).json({ message: "Expiry sweep complete", ...result });
  } catch (error) {
    console.error("runExpirySweep error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/admin/jobs/sync-shop-name/:id
export const queueShopNameSync = async (req, res) => {
  try {
    const queued = await enqueue(JOBS.SYNC_SHOP_NAME, {
      shopId: req.params.id,
    });

    res.status(queued ? 202 : 503).json({
      message: queued
        ? "Shop name sync queued"
        : "No queue connected - set REDIS_URL to enable background jobs",
    });
  } catch (error) {
    console.error("queueShopNameSync error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
