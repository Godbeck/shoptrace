import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary reads CLOUDINARY_URL from the environment on its own, but the
 * discrete variables are supported too so either style of setup works.
 *
 * Configured on FIRST USE, not at import time. ES modules evaluate every
 * import before any module body runs, so this file's top level executes
 * before app.js reaches its own dotenv.config() line - at which point every
 * CLOUDINARY_* variable is still undefined and the SDK is handed nothing.
 * The failure is quiet and confusing: isCloudinaryConfigured() is a function,
 * so by request time it sees the env and returns true, while the SDK has no
 * api_key and every upload dies with "Must supply api_key".
 */
let configured = false;

const ensureConfigured = () => {
  if (configured) return;

  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  } else {
    // The SDK parses CLOUDINARY_URL itself, but only when it reads the
    // environment - which is now, rather than at import.
    cloudinary.config(true);
    cloudinary.config({ secure: true });
  }

  configured = true;
};

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_SECRET),
  );

/**
 * Cloudinary's upload_stream is callback-based, so it is wrapped in a Promise
 * to fit the async/await style of the rest of the codebase.
 *
 * The transformation is applied on upload rather than on read: most users are
 * on mobile data, so a 4MB phone photo is resized once here instead of being
 * shipped in full to every customer who views the product.
 */
export const uploadBuffer = (buffer, folder) =>
  new Promise((resolve, reject) => {
    ensureConfigured();
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto:good" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );

    stream.end(buffer);
  });

export const destroyImage = (publicId) => {
  ensureConfigured();
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
};

export default cloudinary;
