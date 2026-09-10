import multer from "multer";

/**
 * memoryStorage keeps the file in RAM as a Buffer instead of writing it to
 * disk. That suits this setup: the file is going straight on to Cloudinary,
 * so writing it to the server's disk first would be a temporary file to
 * clean up for no benefit. It also works on hosts with a read-only filesystem.
 *
 * The cost is memory - which is why the size limit below matters.
 */
const storage = multer.memoryStorage();

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export const uploadImages = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      // Rejected here, before anything is read into memory.
      return cb(
        new Error("Only JPEG, PNG, WebP or HEIC images can be uploaded"),
      );
    }
    cb(null, true);
  },
}).array("images", 5);

/**
 * multer reports its own errors by calling next(err) with a MulterError, which
 * would otherwise surface as a 500. This turns them into the 400s they are.
 */
export const handleUpload = (req, res, next) => {
  uploadImages(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Each image must be under 5MB" });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res
        .status(400)
        .json({ message: "You can upload at most 5 images at a time" });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res
        .status(400)
        .json({ message: 'Send the files in a field named "images"' });
    }

    res.status(400).json({ message: error.message });
  });
};
