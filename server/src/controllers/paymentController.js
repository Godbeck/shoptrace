import mongoose from "mongoose";
import Order from "../models/Order.js";
import {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  toCedis,
  initiateRefund,
} from "../utils/paystack.js";

/**
 * Find the order a Paystack event belongs to.
 *
 * The reference IS the order number, so the lookup does not have to depend on
 * initiatePayment having saved paystackReference first. If that save failed, or
 * the webhook arrives before it commits, a real payment would otherwise be
 * orphaned - money taken with no order marked paid.
 */
const findOrderByReference = async (reference, metadata = {}) => {
  let order = await Order.findOne({ paystackReference: reference });
  if (order) return order;

  order = await Order.findOne({ orderNumber: reference });
  if (order) return order;

  if (metadata.orderId && mongoose.isValidObjectId(metadata.orderId)) {
    return Order.findById(metadata.orderId);
  }
  return null;
};

/**
 * Mark an order paid, exactly once.
 *
 * Paystack will call the webhook, and the app will also call verify when the
 * customer returns from the checkout page. Both can arrive, in either order,
 * and Paystack retries failed webhooks. So this has to be idempotent.
 *
 * The guard is the query itself: paymentStatus must not already be 'paid'.
 * MongoDB applies that condition and the write as one operation, so of two
 * simultaneous calls exactly one updates a document and the other gets null.
 * Checking with a read first and then writing would let both through.
 */
const markOrderPaid = async (order, { reference, channel }) => {
  const now = new Date();

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $ne: "paid" } },
    {
      $set: {
        paymentStatus: "paid",
        paidAt: now,
        paystackReference: reference,
        ...(channel ? { paymentMethod: mapChannel(channel) } : {}),
        // AUTO-ACCEPT. A paid order goes straight to accepted rather than
        // waiting for the merchant to tap something.
        //
        // Why: a busy shop can take dozens of orders a day, and making every
        // one wait on a tap turns the merchant into a bottleneck the customer
        // feels. The acceptance step was really a stock check in disguise -
        // and a stock check is better handled by letting the merchant say
        // "can't fulfil" on the rare failure than by making them confirm
        // every success.
        "subOrders.$[waiting].status": "accepted",
      },
      $push: {
        "subOrders.$[waiting].statusHistory": {
          status: "accepted",
          at: now,
          note: "Confirmed automatically on payment",
        },
      },
      // Cleared so the expiry sweep can never cancel a paid order.
      $unset: { expiresAt: "" },
    },
    {
      new: true,
      // Only sub-orders still sitting at pending. A shop that already
      // declined before payment landed is left alone.
      arrayFilters: [{ "waiting.status": "pending" }],
    },
  );

  // null means it was already paid - a duplicate delivery, not a problem.
  return updated;
};

/** Paystack's channel names into our paymentMethod enum. */
const mapChannel = (channel) => {
  if (channel === "mobile_money") return "momo";
  if (channel === "bank" || channel === "bank_transfer") return "bank_transfer";
  return "card";
};

// POST /api/payments/initiate/:orderId
export const initiatePayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "This is not your order" });
    }
    if (order.paymentStatus === "paid") {
      return res
        .status(409)
        .json({ message: "This order has already been paid for" });
    }
    if (order.expiresAt && order.expiresAt <= new Date()) {
      return res
        .status(409)
        .json({ message: "This order has expired - please check out again" });
    }

    // The order number is the payment reference. One human-readable id links
    // the order, the Paystack dashboard entry and any support call.
    const reference = order.orderNumber;

    const transaction = await initializeTransaction({
      email: req.user.email,
      // The amount comes from the stored order, never from the request body.
      amountCedis: order.grandTotal,
      reference,
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        customerId: req.user._id.toString(),
      },
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
    });

    order.paystackReference = reference;
    await order.save();

    res.status(200).json({
      authorizationUrl: transaction.authorization_url,
      accessCode: transaction.access_code,
      reference,
      amount: order.grandTotal,
    });
  } catch (error) {
    console.error("initiatePayment error:", error);
    res
      .status(502)
      .json({ message: "Could not start the payment. Please try again." });
  }
};

/**
 * GET /api/payments/verify/:reference
 *
 * Called by the app when the customer comes back from Paystack. This is the
 * fast path so the success screen does not have to wait for the webhook.
 */
export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const order = await findOrderByReference(reference);
    if (!order) {
      return res.status(404).json({ message: "No order for that reference" });
    }
    if (
      order.customer.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "This is not your order" });
    }

    const transaction = await verifyTransaction(reference);

    if (transaction.status !== "success") {
      return res.status(200).json({
        paid: false,
        gatewayStatus: transaction.status,
        message: "Payment has not gone through",
      });
    }

    // Guard against a short payment - a reference is public, the amount is not
    // something we should take on trust.
    const paidCedis = toCedis(transaction.amount);
    if (paidCedis + 0.01 < order.grandTotal) {
      console.error(
        `Underpayment on ${reference}: paid ${paidCedis}, expected ${order.grandTotal}`,
      );
      return res.status(409).json({
        paid: false,
        message: "The amount paid does not match this order",
      });
    }

    const updated = await markOrderPaid(order, {
      reference,
      channel: transaction.channel,
    });

    res.status(200).json({
      paid: true,
      alreadyRecorded: updated === null,
      order: updated || order,
    });
  } catch (error) {
    console.error("verifyPayment error:", error);
    res.status(502).json({ message: "Could not verify the payment" });
  }
};

/**
 * POST /api/payments/webhook
 *
 * Paystack's own notification. This is the source of truth: it arrives even if
 * the customer closes the app mid-payment.
 *
 * req.body here is a raw Buffer, not a parsed object - see how this route is
 * mounted in app.js. The signature is over the exact bytes Paystack sent.
 */
export const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];

    if (!verifyWebhookSignature(req.body, signature)) {
      // Anyone can POST to this URL. Without this check, they could mark any
      // order paid just by knowing its order number.
      console.warn("Rejected webhook with a bad signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const event = JSON.parse(req.body.toString("utf8"));

    // Answer immediately. Paystack retries anything that is slow or errors,
    // and the work below should not hold that response open.
    res.status(200).json({ received: true });

    if (event.event !== "charge.success") {
      return;
    }

    const reference = event.data?.reference;
    const order = await findOrderByReference(reference, event.data?.metadata);

    if (!order) {
      console.error(`Webhook for unknown reference: ${reference}`);
      return;
    }

    const paidCedis = toCedis(event.data.amount);
    if (paidCedis + 0.01 < order.grandTotal) {
      console.error(
        `Webhook underpayment on ${reference}: paid ${paidCedis}, expected ${order.grandTotal}`,
      );
      return;
    }

    const updated = await markOrderPaid(order, {
      reference,
      channel: event.data.channel,
    });

    console.log(
      updated
        ? `Order ${order.orderNumber} marked paid by webhook`
        : `Order ${order.orderNumber} was already paid - webhook ignored`,
    );
  } catch (error) {
    console.error("paystackWebhook error:", error);
    // If the response has not gone out yet, a non-200 asks Paystack to retry.
    if (!res.headersSent) {
      res.status(500).json({ message: "Webhook processing failed" });
    }
  }
};

/**
 * POST /api/payments/refund/:orderId  (admin)
 *
 * Deliberately admin-only and manual. Automatic refunds on cancellation need
 * a policy decision - who pays the delivery cost of a cancelled order - and
 * that is not settled yet.
 */
export const refundOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.paymentStatus !== "paid") {
      return res
        .status(409)
        .json({ message: "This order has not been paid, so it cannot be refunded" });
    }

    const amountCedis = req.body.amount ? Number(req.body.amount) : undefined;

    if (amountCedis !== undefined) {
      if (Number.isNaN(amountCedis) || amountCedis <= 0) {
        return res.status(400).json({ message: "Refund amount is not valid" });
      }
      if (amountCedis > order.grandTotal) {
        return res
          .status(400)
          .json({ message: "Refund cannot be more than the order total" });
      }
    }

    await initiateRefund({
      reference: order.paystackReference,
      amountCedis,
    });

    order.paymentStatus =
      amountCedis === undefined || amountCedis >= order.grandTotal
        ? "refunded"
        : "partially_refunded";
    await order.save();

    res.status(200).json({ message: "Refund submitted to Paystack", order });
  } catch (error) {
    console.error("refundOrder error:", error);
    res.status(502).json({ message: "Could not process the refund" });
  }
};

/**
 * POST /api/payments/mock-pay/:orderId
 *
 * Marks an order paid WITHOUT Paystack, so the whole order lifecycle can be
 * walked before a payment provider exists: check out, merchant accepts, status
 * advances, customer watches it happen.
 *
 * Three things make this safe to keep in the codebase:
 *
 *  1. It refuses to run unless ALLOW_MOCK_PAYMENTS is explicitly "true".
 *  2. It refuses to run when NODE_ENV is production, flag or no flag.
 *  3. It goes through the SAME markOrderPaid helper the real webhook uses, so
 *     testing with it exercises the real idempotency path rather than a
 *     parallel one that might drift.
 *
 * Delete this handler and its route the day Paystack goes live.
 */
export const mockPayOrder = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Not available" });
    }
    if (process.env.ALLOW_MOCK_PAYMENTS !== "true") {
      return res.status(403).json({
        message:
          "Mock payments are off. Set ALLOW_MOCK_PAYMENTS=true in the server .env while Paystack is not connected.",
      });
    }

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "This is not your order" });
    }
    if (order.paymentStatus === "paid") {
      return res
        .status(409)
        .json({ message: "This order has already been paid for" });
    }
    if (order.expiresAt && order.expiresAt <= new Date()) {
      return res
        .status(409)
        .json({ message: "This order has expired - please check out again" });
    }

    const updated = await markOrderPaid(order, {
      // Prefixed so a mock payment is obvious in the database and can never
      // be mistaken for a real Paystack reference.
      reference: `MOCK-${order.orderNumber}`,
      channel: req.body?.channel === "card" ? "card" : "mobile_money",
    });

    console.log(`MOCK PAYMENT recorded for ${order.orderNumber}`);

    res.status(200).json({ paid: true, mock: true, order: updated || order });
  } catch (error) {
    return sendError(res, error, "mockPayOrder error:");
  }
};
