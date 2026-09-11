import { classifyError } from "../utils/apiError.js";

/** Any URL that matched no route lands here. */
export const notFound = (req, res, next) => {
  res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

/**
 * The last stop for anything a controller did not catch. Express treats a
 * four-argument middleware as an error handler, which is why `err` is first
 * and why `next` must stay in the signature even though it is unused.
 *
 * It classifies errors with the same function controllers use, so a given
 * failure gets the same status code wherever it surfaces.
 */
export const errorHandler = (err, req, res, next) => {
  const known = classifyError(err);

  if (known) {
    return res.status(known.status).json({ message: known.message });
  }

  console.error("Unhandled error:", err);
  res
    .status(err.status || 500)
    .json({ message: err.status ? err.message : "Server error" });
};
