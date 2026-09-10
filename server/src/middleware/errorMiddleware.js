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
 */
export const errorHandler = (err, req, res, next) => {
  // A malformed ObjectId in the URL is the client's fault, not a server fault.
  if (err.name === "CastError" && err.kind === "ObjectId") {
    return res.status(400).json({ message: "Invalid id in request" });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: Object.values(err.errors)
        .map((e) => e.message)
        .join(", "),
    });
  }

  // Duplicate key on a unique index - e.g. an email already registered.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "value";
    return res.status(409).json({ message: `That ${field} is already in use` });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body is not valid JSON" });
  }

  console.error("Unhandled error:", err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
};
