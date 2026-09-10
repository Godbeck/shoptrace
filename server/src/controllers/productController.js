import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import PriceHistory from "../models/PriceHistory.js";

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
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
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
      distance: { distance: -1 },
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
    res.status(500).json({ message: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "shop",
      "name address phone location averageRating status offersDelivery deliveryFee",
    );

    if (!product || !product.isActive) {
      return res.status(400).json({ message: "Product not found" });
    }

    await Product.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    const products = (
      await Product.find({ shop: shop._id, isActive: true })
    ).toSorted({ createdAt: -1 });

    res.status(200).json({
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    await product.save();

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};
