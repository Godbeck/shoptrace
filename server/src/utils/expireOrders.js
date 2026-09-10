import Order from "../models/Order.js";
import { releaseStock, reservationsFromItems } from "../utils/stock.js";

/**
 * Cancel unpaid orders whose hold has run out, and give their stock back.
 *
 * Without this, an abandoned checkout holds stock forever: the reservation
 * succeeded, the customer never paid, and nothing ever puts it back.
 *
 * Lives in utils rather than jobs/ because two callers need it - the BullMQ
 * worker on a schedule, and an admin endpoint for testing it by hand.
 */
export const expireOrders = async () => {
  const expired = await Order.find({
    paymentStatus: "unpaid",
    expiresAt: { $lte: new Date() },
  });

  let released = 0;

  for (const order of expired) {
    for (const subOrder of order.subOrders) {
      // Only sub-orders still holding stock. A sub-order already cancelled
      // has had its stock returned once, and returning it twice would invent
      // inventory that does not exist.
      if (subOrder.status === "cancelled" || subOrder.status === "declined") {
        continue;
      }

      await releaseStock(reservationsFromItems(subOrder.items));
      subOrder.status = "cancelled";
      subOrder.statusHistory.push({
        status: "cancelled",
        at: new Date(),
        note: "Expired - payment not received in time",
      });
      released += 1;
    }

    order.paymentStatus = "failed";
    // Cleared so a re-run cannot pick the same order up again.
    order.expiresAt = undefined;
    await order.save();
  }

  return { ordersExpired: expired.length, subOrdersReleased: released };
};

export default expireOrders;
