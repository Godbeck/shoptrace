import PriceAlert from "../models/PriceAlert.js";
import Product from "../models/Product.js";
import { sendError } from "../utils/apiError.js";

// POST /api/price-alerts
export const createPriceAlert = async (req, res) => {
  try {
    const { productId, targetPrice } = req.body;

    if (!productId || targetPrice === undefined) {
      return res
        .status(400)
        .json({ message: "Product and target price are required" });
    }

    const target = Number(targetPrice);
    if (Number.isNaN(target) || target <= 0) {
      return res
        .status(400)
        .json({ message: "Target price must be greater than 0" });
    }

    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (target >= product.price) {
      return res.status(400).json({
        message: `This product is already GH${product.price} - set a target below that`,
      });
    }

    // upsert, so setting a new target on the same product updates the existing
    // alert instead of tripping the unique index.
    const alert = await PriceAlert.findOneAndUpdate(
      { customer: req.user._id, product: productId },
      {
        targetPrice: target,
        priceWhenSet: product.price,
        isActive: true,
        // A fresh target should be able to fire again.
        $unset: { lastNotifiedAt: "" },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(201).json(alert);
  } catch (error) {
    return sendError(res, error, "createPriceAlert error:");
  }
};

// GET /api/price-alerts
export const getMyPriceAlerts = async (req, res) => {
  try {
    const alerts = await PriceAlert.find({ customer: req.user._id })
      .populate("product", "name brand price imageUrls shopName isActive")
      .sort({ createdAt: -1 });

    res.status(200).json({ count: alerts.length, alerts });
  } catch (error) {
    return sendError(res, error, "getMyPriceAlerts error:");
  }
};

// DELETE /api/price-alerts/:id
export const deletePriceAlert = async (req, res) => {
  try {
    const alert = await PriceAlert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }
    if (alert.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "This is not your alert" });
    }

    await alert.deleteOne();

    res.status(200).json({ message: "Alert removed" });
  } catch (error) {
    return sendError(res, error, "deletePriceAlert error:");
  }
};
