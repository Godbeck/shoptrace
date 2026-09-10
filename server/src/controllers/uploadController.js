import {
  uploadBuffer,
  destroyImage,
  isCloudinaryConfigured,
} from "../config/cloudinary.js";
import Shop from "../models/Shop.js";

// POST /api/uploads/products
export const uploadProductImages = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res
        .status(503)
        .json({ message: "Image uploads are not configured on this server" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images were sent" });
    }

    // The folder is built from the merchant's own shop id, taken from the
    // server side. If the client could name the folder, one merchant could
    // write into another merchant's folder.
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res
        .status(404)
        .json({ message: "You must register a shop before uploading images" });
    }

    const uploads = await Promise.all(
      req.files.map((file) =>
        uploadBuffer(file.buffer, `shoptrace/shops/${shop._id}/products`),
      ),
    );

    res.status(201).json({
      count: uploads.length,
      images: uploads.map((upload) => ({
        url: upload.secure_url,
        publicId: upload.public_id,
        width: upload.width,
        height: upload.height,
        bytes: upload.bytes,
      })),
    });
  } catch (error) {
    console.error("uploadProductImages error:", error);
    res.status(502).json({ message: "Could not upload the images" });
  }
};

// POST /api/uploads/shop-logo
export const uploadShopLogo = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res
        .status(503)
        .json({ message: "Image uploads are not configured on this server" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No image was sent" });
    }

    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const upload = await uploadBuffer(
      req.files[0].buffer,
      `shoptrace/shops/${shop._id}`,
    );

    // Saved straight on to the shop - a logo has one slot, unlike product
    // images where the merchant chooses the order.
    shop.logoUrl = upload.secure_url;
    await shop.save();

    res.status(201).json({ logoUrl: shop.logoUrl, publicId: upload.public_id });
  } catch (error) {
    console.error("uploadShopLogo error:", error);
    res.status(502).json({ message: "Could not upload the logo" });
  }
};

// DELETE /api/uploads/:publicId(*)
export const deleteImage = async (req, res) => {
  try {
    // publicId contains slashes, so it arrives as a query parameter rather
    // than a path segment.
    const { publicId } = req.query;

    if (!publicId) {
      return res.status(400).json({ message: "publicId is required" });
    }

    // Ownership is enforced through the folder path, which was built from the
    // shop id at upload time.
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const ownFolder = `shoptrace/shops/${shop._id}`;
    if (!publicId.startsWith(ownFolder) && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You can only delete your own images" });
    }

    const result = await destroyImage(publicId);

    if (result.result !== "ok" && result.result !== "not found") {
      return res.status(502).json({ message: "Could not delete the image" });
    }

    res.status(200).json({ message: "Image removed" });
  } catch (error) {
    console.error("deleteImage error:", error);
    res.status(502).json({ message: "Could not delete the image" });
  }
};
