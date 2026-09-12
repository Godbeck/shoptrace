/** The shape of GET /api/merchant/summary. */
export type MerchantSummary = {
  shop: {
    _id: string;
    name: string;
    status: "pending" | "verified" | "suspended";
    address: string;
    category: string;
    deliveryRange: "none" | "area" | "city" | "nationwide";
    averageRating: number;
    reviewCount: number;
    isFeatured: boolean;
    subscriptionTier: "free" | "growth" | "pro";
    subscriptionExpiresAt?: string;
  };
  period: { days: number; since: string };
  stats: {
    revenue: number;
    pipelineValue: number;
    orders: number;
    completed: number;
    declined: number;
    pendingOrders: number;
    views: number;
    products: number;
    outOfStock: number;
    lowStock: number;
    staleStock: number;
    fulfilmentRate: number | null;
    fulfilledCount: number;
    declinedCount: number;
    averageOrder: number;
    conversionRate: number;
    productLimit: number;
  };
  byDay: { date: string; revenue: number; orders: number; weekday: number }[];
  topProducts: {
    product: string;
    name: string;
    units: number;
    orders: number;
    revenue: number;
  }[];
  /**
   * Only the steps that are actually tracked. Clicks and add-to-cart are not
   * recorded anywhere, so the funnel is three steps rather than a fake five.
   */
  funnel: { label: string; value: number }[];
};
