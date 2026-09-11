/**
 * One place that decides what an error MEANS, so the same failure gets the
 * same status code whether it surfaces in a controller's catch block or in
 * the error middleware.
 *
 * This exists because of a real bug: every controller wraps its work in its
 * own try/catch and answered with a 500. So a Mongoose ValidationError -
 * "Password must be at least 6 characters long" - reached the client as
 * "Server error", and the app had nothing useful to show the user.
 */
export const classifyError = (error) => {
  // Schema validation: the client sent something the model refuses.
  if (error.name === "ValidationError" && error.errors) {
    return {
      status: 400,
      message: Object.values(error.errors)
        .map((e) => e.message)
        .join(", "),
    };
  }

  // A malformed id that slipped past validateObjectId.
  if (error.name === "CastError") {
    return { status: 400, message: `Invalid value for ${error.path}` };
  }

  // Duplicate key on a unique index.
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || "value";
    return { status: 409, message: `That ${field} is already in use` };
  }

  if (error.type === "entity.parse.failed") {
    return { status: 400, message: "Request body is not valid JSON" };
  }

  // Not a known client mistake - the caller should treat it as a 500.
  return null;
};

/**
 * Answer a request that failed. Use this in a controller's catch block
 * instead of a bare res.status(500).
 *
 * A recognised client mistake gets its real status code and a message the
 * app can show. Anything else is logged in full and returned as a flat
 * "Server error", so internal details never reach the client.
 */
export const sendError = (res, error, context = "Unhandled error:") => {
  const known = classifyError(error);

  if (known) {
    return res.status(known.status).json({ message: known.message });
  }

  console.error(context, error);
  return res.status(500).json({ message: "Server error" });
};
