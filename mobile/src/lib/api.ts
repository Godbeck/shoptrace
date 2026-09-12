import Constants from "expo-constants";

/**
 * The one place that knows how to reach the server.
 *
 * Every screen calls `api.get(...)` / `api.post(...)` and never touches fetch
 * directly, so the base URL, the token header and error handling all live here.
 */

/**
 * Working out the base URL is the single most common thing to get wrong in an
 * Expo project, so it is worked out rather than hardcoded:
 *
 *  - iOS simulator can reach the Mac on localhost.
 *  - Android emulator CANNOT - it needs 10.0.2.2 for the host machine.
 *  - A real phone on Expo Go needs your Mac's LAN IP, which Expo already
 *    knows because that is how it served the bundle. We read it back off the
 *    dev server host.
 *
 * Override any of this with EXPO_PUBLIC_API_URL in a .env file.
 */
const PORT = 4000;

const resolveBaseUrl = (): string => {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, "");

  // e.g. "192.168.1.42:8081" while running in Expo Go
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;

  const host = hostUri?.split(":")[0];

  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${PORT}`;
  }

  return `http://localhost:${PORT}`;
};

export const BASE_URL = resolveBaseUrl();
export const API_URL = `${BASE_URL}/api`;

/** Set by the session once someone signs in. */
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

/**
 * An error carrying the server's own message and status code, so screens can
 * show what actually went wrong rather than "something went wrong".
 *
 * The server was built to return usable messages - "Password must be at least
 * 6 characters long" - and throwing them away here would waste that.
 */
export class ApiError extends Error {
  status: number;
  body: any;

  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  /** Fail fast rather than hanging when the server is unreachable. */
  timeoutMs?: number;
};

const request = async <T = any>(
  path: string,
  { method = "GET", body, timeoutMs = 15000 }: Options = {},
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? safeParse(text) : null;

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data?.message || `Request failed (${response.status})`,
        data,
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if ((error as Error).name === "AbortError") {
      throw new ApiError(
        0,
        `The server did not respond. Is it running on ${BASE_URL}?`,
      );
    }

    // A network-level failure, which on a phone almost always means the base
    // URL is pointing somewhere the device cannot reach.
    throw new ApiError(
      0,
      `Cannot reach the server at ${BASE_URL}. Check it is running and that your phone is on the same network.`,
    );
  } finally {
    clearTimeout(timer);
  }
};

const safeParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),
  patch: <T = any>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T = any>(path: string) => request<T>(path, { method: "DELETE" }),
};

/* ------------------------------------------------------------- shapes */

/** Mirrors what the server actually returns, so screens can rely on it. */
export type ApiUser = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "merchant" | "admin";
  token?: string;
};

export type ApiAddress = {
  _id: string;
  label: string;
  address: string;
  location: { type: "Point"; coordinates: [number, number] };
  isDefault: boolean;
};

export type ApiPaymentMethod = {
  _id: string;
  type: "momo";
  provider: "MTN" | "Vodafone" | "AirtelTigo";
  phone: string;
  isDefault: boolean;
};

export type ApiProduct = {
  _id: string;
  name: string;
  brand?: string;
  category: string;
  description?: string;
  price: number;
  stockCount: number;
  inStock: boolean;
  imageUrls: string[];
  isFeatured: boolean;
  viewCount: number;
  shop: any;
  shopName: string;
  distance?: number;
  /** When the merchant last vouched for stockCount - not when it last changed. */
  stockConfirmedAt?: string;
  stockConfidence?: "fresh" | "aging" | "stale";
  needsConfirmation?: boolean;
  fulfilmentRate?: number | null;
  location?: { coordinates: [number, number] };
};

export type ApiShop = {
  _id: string;
  name: string;
  /** A shop can sell across several. Products carry exactly one. */
  categories: string[];
  address: string;
  phone: string;
  status: "pending" | "verified" | "suspended";
  averageRating: number;
  reviewCount: number;
  isFeatured: boolean;
  deliveryRange: "none" | "area" | "city" | "nationwide";
  openingHours: string;
  logoUrl?: string;
  location: { coordinates: [number, number] };
};

export type ApiSubOrder = {
  _id: string;
  shop: string;
  shopName: string;
  shopPhone: string;
  items: {
    product: string;
    name: string;
    brand?: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    lineTotal: number;
  }[];
  subtotal: number;
  deliveryMethod: "delivery" | "pickup";
  deliveryFee: number;
  distanceMeters?: number;
  deliveryTier?: string;
  deliveryEstimate?: string;
  status:
    | "pending"
    | "accepted"
    | "packed"
    | "out_for_delivery"
    | "ready_for_pickup"
    | "completed"
    | "declined"
    | "cancelled";
  statusHistory: { status: string; at: string; note?: string }[];
  declineReason?: string;
};

export type ApiOrder = {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  subOrders: ApiSubOrder[];
  itemsTotal: number;
  deliveryTotal: number;
  platformFee: number;
  grandTotal: number;
  paymentStatus: "unpaid" | "paid" | "failed" | "refunded";
  paymentMethod?: string;
  paidAt?: string;
  overallStatus?: string;
  expiresAt?: string;
  createdAt: string;
};

/** What a merchant sees - one sub-order, no basket total. */
export type ApiMerchantOrder = {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  paymentStatus: string;
  createdAt: string;
  subOrder: ApiSubOrder;
};

export type ApiPriceAlert = {
  _id: string;
  product: ApiProduct | string;
  targetPrice: number;
  priceWhenSet: number;
  isActive: boolean;
  lastNotifiedAt?: string;
  createdAt: string;
};
