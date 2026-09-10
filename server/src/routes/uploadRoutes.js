import express from "express";
import {
  uploadProductImages,
  uploadShopLogo,
  deleteImage,
} from "../controllers/uploadController.js";
import { handleUpload } from "../middleware/uploadMiddleware.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Order matters: protect and authorize run before multer, so an unauthorised
// request is rejected before a single byte of image is read into memory.
router.post(
  "/products",
  protect,
  authorize("merchant"),
  handleUpload,
  uploadProductImages,
);
router.post(
  "/shop-logo",
  protect,
  authorize("merchant"),
  handleUpload,
  uploadShopLogo,
);
router.delete("/", protect, authorize("merchant", "admin"), deleteImage);

export default router;
