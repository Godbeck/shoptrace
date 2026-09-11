import mongoose from "mongoose";

/**
 * Reject a malformed id before the controller ever runs.
 *
 * Why this exists rather than letting errorMiddleware handle it: every
 * controller wraps its work in its own try/catch and answers with a 500. So a
 * Mongoose CastError never reaches the error handler - it gets caught first
 * and returned as "Cast to ObjectId failed for value ... for model Product",
 * which is both the wrong status code and an internal detail the client has
 * no business seeing.
 *
 * Checking at the route layer also saves a pointless database round trip.
 *
 * Usage: validateObjectId() for :id, or validateObjectId('orderId').
 */
const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const value = req.params[paramName];

    if (!mongoose.isValidObjectId(value)) {
      return res.status(400).json({
        message: `Invalid id in request: "${value}" is not a valid id`,
      });
    }
    next();
  };
};

export default validateObjectId;
