import type { ApiSubOrder } from "./api";

/**
 * How each server status should read on screen, in one place, because the
 * customer tracking screen and the merchant queue must never describe the
 * same status differently.
 */
export const STATUS_META: Record<
  ApiSubOrder["status"],
  {
    label: string;
    merchantLabel: string;
    icon: string;
    tone: "success" | "warning" | "info" | "danger";
  }
> = {
  // pending only survives between placing an order and paying for it -
  // payment auto-accepts. A customer rarely sees it.
  pending: { label: "Awaiting payment", merchantLabel: "Unpaid", icon: "hourglass-outline", tone: "warning" },
  accepted: { label: "Order confirmed", merchantLabel: "To pack", icon: "checkmark-circle-outline", tone: "info" },
  packed: { label: "Packed", merchantLabel: "Packed", icon: "cube-outline", tone: "info" },
  out_for_delivery: { label: "On the way", merchantLabel: "Out for delivery", icon: "bicycle-outline", tone: "info" },
  ready_for_pickup: { label: "Ready for pickup", merchantLabel: "Ready for pickup", icon: "storefront-outline", tone: "info" },
  completed: { label: "Delivered", merchantLabel: "Completed", icon: "checkmark-done-outline", tone: "success" },
  declined: { label: "Declined by shop", merchantLabel: "Declined", icon: "close-circle-outline", tone: "danger" },
  cancelled: { label: "Cancelled", merchantLabel: "Cancelled", icon: "close-circle-outline", tone: "danger" },
};

/** The delivery journey, and the pickup one. */
export const DELIVERY_FLOW: ApiSubOrder["status"][] = [
  "pending",
  "accepted",
  "packed",
  "out_for_delivery",
  "completed",
];

export const PICKUP_FLOW: ApiSubOrder["status"][] = [
  "pending",
  "accepted",
  "packed",
  "ready_for_pickup",
  "completed",
];

export const flowFor = (sub: ApiSubOrder) =>
  sub.deliveryMethod === "pickup" ? PICKUP_FLOW : DELIVERY_FLOW;

/**
 * The server's ALLOWED_TRANSITIONS map, mirrored.
 *
 * The app only ever offers a move the API would actually accept - otherwise a
 * merchant taps a button and gets a 400 back, which is a bad way to learn the
 * rules.
 */
export const nextStatus = (sub: ApiSubOrder): ApiSubOrder["status"] | null => {
  switch (sub.status) {
    case "pending":
      return "accepted";
    case "accepted":
      return "packed";
    case "packed":
      return sub.deliveryMethod === "pickup" ? "ready_for_pickup" : "out_for_delivery";
    case "out_for_delivery":
    case "ready_for_pickup":
      return "completed";
    default:
      return null;
  }
};

export const nextActionLabel = (sub: ApiSubOrder): string | null => {
  switch (sub.status) {
    case "pending":
      return "Accept";
    case "accepted":
      // Orders arrive already confirmed, so the first real action is packing.
      return "Start packing";
    case "packed":
      return sub.deliveryMethod === "pickup" ? "Mark ready" : "Mark sent";
    case "out_for_delivery":
    case "ready_for_pickup":
      return "Mark completed";
    default:
      return null;
  }
};

/**
 * Whether the merchant can still bail out of this sub-order.
 *
 * Mirrors the server's transitions: declining is allowed right up to the
 * point the goods leave the shop. That is the escape hatch for stock that
 * was sold over the counter and never updated here.
 */
export const canDecline = (sub: ApiSubOrder) =>
  ["pending", "accepted", "packed"].includes(sub.status);

/** Mirrors Order.overallStatus on the server. */
export const overallStatus = (subOrders: ApiSubOrder[]) => {
  const statuses = subOrders.map((s) => s.status);
  if (statuses.every((s) => s === "completed"))
    return { label: "Delivered", tone: "success" as const, group: "Delivered" };
  if (statuses.every((s) => s === "cancelled" || s === "declined"))
    return { label: "Cancelled", tone: "danger" as const, group: "Cancelled" };
  if (statuses.some((s) => s === "completed"))
    return { label: "Partly delivered", tone: "info" as const, group: "Active" };
  if (statuses.some((s) => s === "out_for_delivery"))
    return { label: "On the way", tone: "info" as const, group: "Active" };
  if (statuses.some((s) => s === "ready_for_pickup"))
    return { label: "Ready for pickup", tone: "info" as const, group: "Active" };
  if (statuses.some((s) => s === "packed"))
    return { label: "Being packed", tone: "info" as const, group: "Active" };
  if (statuses.some((s) => s === "accepted"))
    return { label: "Confirmed", tone: "info" as const, group: "Active" };
  return { label: "Awaiting payment", tone: "warning" as const, group: "Active" };
};
