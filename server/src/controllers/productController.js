import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import PriceHistory from "../models/PriceHistory.js";
import Settings from "../models/Settings.js";
import { getDistanceMeters } from "../utils/deliveryCalculator.js";
import {
  AGING_MS,
  fulfilmentRate,
  needsConfirmation,
  stockConfidence,
} from "../utils/stockConfidence.js";
import { sendError } from "../utils/apiError.js";

export const createProduct = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res
        .status(404)
        .json({ message: "You must register a shop before adding products" });
    }

    if (shop.status !== "verified") {
      return res
        .status(403)
        .json({
          message: "Your shop must be verified before you can list products",
        });
    }

    // The subscription gate. The limit comes from settings, not from the shop
    // document, so raising the free allowance is one edit and not a migration.
    const settings = await Settings.get();
    const tier = shop.subscriptionTier || "free";
    const hasExpired =
      tier !== "free" &&
      shop.subscriptionExpiresAt &&
      shop.subscriptionExpiresAt <= new Date();
    const effectiveTier = hasExpired ? "free" : tier;
    const productLimit = settings.subscriptionTiers[effectiveTier].productLimit;

    const currentCount = await Product.countDocuments({
      shop: shop._id,
      isActive: true,
    });

    if (currentCount >= productLimit) {
      return res.status(403).json({
        message:
          `Your ${effectiveTier} plan allows ${productLimit} products. ` +
          `Upgrade to list more.`,
        productLimit,
        currentCount,
        tier: effectiveTier,
      });
    }

    const {
      name,
      brand,
      category,
      price,
      description,
      stockCount,
      condition,
      imageUrls,
    } = req.body;

    if (!name || !category || price === undefined) {
      return res
        .status(400)
        .json({ message: "Name, category and price are required" });
    }

    const product = await Product.create({
      shop: shop._id,
      shopName: shop.name,
      location: shop.location,
      name,
      brand,
      category,
      description,
      price,
      stockCount: stockCount || 0,
      condition,
      imageUrls: imageUrls || [],
      // Listing it counts as vouching for the count.
      stockConfirmedAt: new Date(),
    });

    res.status(201).json(product);
  } catch (error) {
    return sendError(res, error, "createProduct error:");
  }
};

export const searchProducts = async (req, res) => {
  try {
    const {
      search,
      latitude,
      longitude,
      radius = 5000,
      category,
      minPrice,
      maxPrice,
      inStockOnly,
      sort = "distance",
      page = 1,
      limit = 20,
    } = req.query;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required" });
    }

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          distanceField: "distance",
          maxDistance: parseInt(radius),
          query: { isActive: true },
          spherical: true,
        },
      },
    ];

    const matchStage = {};

    if (search) {
      matchStage.name = { $regex: search, $options: "i" };
    }

    if (category) {
      matchStage.category = category;
    }

    if (inStockOnly === "true") {
      matchStage.inStock = true;
    }

    if (minPrice || maxPrice) {
      matchStage.price = {};
      if (minPrice) matchStage.price.$gte = parseFloat(minPrice);
      if (maxPrice) matchStage.price.$lte = parseFloat(maxPrice);
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    const sortOptions = {
      // 1 and not -1: $geoNear writes distance in metres, so ascending is
      // nearest-first. -1 would have shown the furthest shop at the top.
      distance: { distance: 1 },
      priceLow: { price: 1 },
      priceHigh: { price: -1 },
      newest: { createdAt: -1 },
    };

    pipeline.push({ $sort: sortOptions[sort] || sortOptions.distance });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const products = await Product.aggregate(pipeline);

    res.status(200).json({
      count: products.length,
      page: parseInt(page),
      products,
    });
  } catch (error) {
    return sendError(res, error, "searchProducts error:");
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "shop",
      "name address phone location averageRating reviewCount status deliveryRange logoUrl fulfilledCount declinedCount",
    );

    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }

    await Product.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    res.status(200).json({
      ...product.toObject(),
      stockConfidence: stockConfidence(product.stockConfirmedAt),
      fulfilmentRate: fulfilmentRate(product.shop),
      needsConfirmation: needsConfirmation(product, product.shop),
    });
  } catch (error) {
    return sendError(res, error, "getProductById error:");
  }
};

export const getMyProducts = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res
        .status(404)
        .json({ message: "You have not registered a shop yet" });
    }

    // .sort() on the query, so MongoDB does the sorting. The previous
    // Array.prototype.toSorted() call threw - it takes a compare function,
    // not a Mongoose sort object.
    const products = await Product.find({
      shop: shop._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      count: products.length,
      products,
    });
  } catch (error) {
    return sendError(res, error, "getMyProducts error:");
  }
};

export const updateProduct = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.shop.toString() !== shop._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only edit your own products" });
    }

    const allowedFields = [
      "name",
      "brand",
      "category",
      "description",
      "price",
      "stockCount",
      "condition",
      "imageUrls",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    // A merchant touching the stock figure is exactly the signal we track.
    // Note this is NOT set when checkout decrements stock - an automatic
    // decrement says nothing about sales made in the shop.
    if (req.body.stockCount !== undefined) {
      product.stockConfirmedAt = new Date();
    }

    await product.save();

    res.status(200).json(product);
  } catch (error) {
    return sendError(res, error, "updateProduct error:");
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.shop.toString() !== shop._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only delete your own products" });
    }

    product.isActive = false;
    await product.save();

    res.status(200).json({ message: "Product removed" });
  } catch (error) {
    return sendError(res, error, "deleteProduct error:");
  }
};

/**
 * PATCH /api/products/:id/confirm-stock
 *
 * The cheap version of keeping stock honest: one tap that either says "yes,
 * still correct" or corrects the figure. Refreshing confirmation is the whole
 * job, so this deliberately does not accept price or anything else.
 */
export const confirmStock = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.shop.toString() !== shop._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only confirm your own products" });
    }

    if (req.body.stockCount !== undefined) {
      const next = Number(req.body.stockCount);
      if (!Number.isInteger(next) || next < 0) {
        return res
          .status(400)
          .json({ message: "Stock must be a whole number of 0 or more" });
      }
      product.stockCount = next;
    }

    product.stockConfirmedAt = new Date();
    await product.save();

    res.status(200).json(product);
  } catch (error) {
    return sendError(res, error, "confirmStock error:");
  }
};

/**
 * GET /api/products/stale
 *
 * The merchant's own products whose stock has not been confirmed lately, so
 * the app can prompt for a quick pass rather than waiting for a failed order
 * to reveal the problem.
 */
export const getStaleStock = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res
        .status(404)
        .json({ message: "You have not registered a shop yet" });
    }

    const cutoff = new Date(Date.now() - AGING_MS);

    const products = await Product.find({
      shop: shop._id,
      isActive: true,
      $or: [
        { stockConfirmedAt: { $lte: cutoff } },
        { stockConfirmedAt: { $exists: false } },
      ],
    }).sort({ stockConfirmedAt: 1 });

    res.status(200).json({
      count: products.length,
      cutoffDays: AGING_MS / (24 * 60 * 60 * 1000),
      products,
    });
  } catch (error) {
    return sendError(res, error, "getStaleStock error:");
  }
};

export const getPriceHistory = async (req, res) => {
  try {
    const history = await PriceHistory.find({ product: req.params.id })
      .sort({ createdAt: -1 })
      .limit(30);

    res.status(200).json({
      count: history.length,
      history,
    });
  } catch (error) {
    return sendError(res, error, "getPriceHistory error:");
  }
};

/**
 * GET /api/products/:id/compare
 *
 * Every shop selling the same product, cheapest first. This is the whole point
 * of ShopTrace, so it gets its own endpoint.
 *
 * HOW PRODUCTS ARE MATCHED, and why it is a compromise: there is no shared
 * catalogue. Each shop creates its own Product document, so "Infinix Hot 40i"
 * at three shops is three unrelated rows. They are matched here on a
 * normalised name, which works when merchants type the same thing and fails
 * when they do not.
 *
 * The real fix is a catalogue - a Product that shops attach offers to - and
 * that is a migration, not an endpoint. Worth doing before launch.
 */
export const compareProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Escape anything regex-significant in the name before building a pattern
    // from it - a product called "Samsung 43\" TV (2024)" would otherwise
    // throw or match the wrong things.
    const escaped = product.name
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const matches = await Product.find({
      name: { $regex: `^${escaped}$`, $options: "i" },
      isActive: true,
    }).populate(
      "shop",
      "name address phone status deliveryRange averageRating location fulfilledCount declinedCount",
    );

    // Only verified shops - an unverified shop is invisible everywhere else,
    // and it would be odd for it to appear in a price comparison.
    const offers = matches
      .filter((p) => p.shop && p.shop.status === "verified")
      .map((p) => {
        const [shopLng, shopLat] = p.shop.location?.coordinates ?? [];
        let distanceMeters = null;

        if (
          req.query.latitude !== undefined &&
          req.query.longitude !== undefined &&
          shopLat !== undefined
        ) {
          distanceMeters = getDistanceMeters(
            [parseFloat(req.query.longitude), parseFloat(req.query.latitude)],
            [shopLng, shopLat],
          );
        }

        return {
          _id: p._id,
          price: p.price,
          stockCount: p.stockCount,
          inStock: p.inStock,
          condition: p.condition,
          // How much this stock figure can be trusted, and how reliable the
          // shop behind it has been.
          stockConfirmedAt: p.stockConfirmedAt,
          stockConfidence: stockConfidence(p.stockConfirmedAt),
          fulfilmentRate: fulfilmentRate(p.shop),
          needsConfirmation: needsConfirmation(p, p.shop),
          isSelected: p._id.toString() === product._id.toString(),
          shop: {
            _id: p.shop._id,
            name: p.shop.name,
            address: p.shop.address,
            phone: p.shop.phone,
            deliveryRange: p.shop.deliveryRange,
            averageRating: p.shop.averageRating,
            fulfilledCount: p.shop.fulfilledCount,
            declinedCount: p.shop.declinedCount,
          },
          distanceMeters,
        };
      })
      .sort((a, b) => a.price - b.price);

    const prices = offers.map((o) => o.price);

    res.status(200).json({
      name: product.name,
      brand: product.brand,
      category: product.category,
      count: offers.length,
      lowest: prices.length ? Math.min(...prices) : product.price,
      highest: prices.length ? Math.max(...prices) : product.price,
      offers,
    });
  } catch (error) {
    return sendError(res, error, "compareProduct error:");
  }
};
