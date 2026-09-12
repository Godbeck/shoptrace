/**
 * Notifications, and the unread count on the bell.
 *
 * There is no notifications endpoint yet, so the feed is derived from things
 * the server already records: status changes on your orders, payments, and
 * price alerts whose target has been beaten. When a real endpoint exists this
 * provider swaps its source and nothing else changes.
 *
 * "Unread" is a timestamp kept on the device. The server has no concept of a
 * read receipt, and inventing one here would mean writing to a model that
 * does not know about it.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, type ApiOrder, type ApiPriceAlert, type ApiProduct } from "./api";
import { useSession } from "./session";
import { cedis } from "./format";
import { STATUS_META } from "./orderStatus";

const READ_KEY = "shoptrace.notificationsReadAt";

export type NotificationItem = {
  id: string;
  icon: string;
  title: string;
  body: string;
  at: string;
  href?: string;
};

type NotificationsValue = {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  reload: () => void;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

export const NotificationsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { signedIn } = useSession();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [alerts, setAlerts] = useState<ApiPriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [readAt, setReadAt] = useState<number>(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(READ_KEY)
      .then((v) => setReadAt(v ? Number(v) : 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // A guest has no orders and no alerts, so there is nothing to fetch and
    // no badge to show.
    if (!signedIn) {
      setOrders([]);
      setAlerts([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.get<{ orders: ApiOrder[] }>("/orders/my-orders?limit=20").catch(() => null),
      api.get<{ alerts: ApiPriceAlert[] }>("/price-alerts").catch(() => null),
    ])
      .then(([o, a]) => {
        if (cancelled) return;
        setOrders(o?.orders ?? []);
        setAlerts(a?.alerts ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, nonce]);

  const items = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    for (const order of orders) {
      for (const sub of order.subOrders) {
        for (const entry of sub.statusHistory) {
          // "Order placed" is something you did, not news.
          if (entry.status === "pending") continue;

          const meta = STATUS_META[entry.status as keyof typeof STATUS_META];
          if (!meta) continue;

          list.push({
            id: `${order._id}-${sub._id ?? sub.shop}-${entry.status}`,
            icon: meta.icon,
            title: `${order.orderNumber} · ${meta.label}`,
            body: entry.note
              ? `${sub.shopName} — ${entry.note}`
              : `${sub.shopName} updated your order`,
            at: entry.at,
            href: `/order/${order._id}`,
          });
        }
      }

      if (order.paymentStatus === "paid" && order.paidAt) {
        list.push({
          id: `${order._id}-paid`,
          icon: "checkmark-circle-outline",
          title: `${order.orderNumber} · Payment received`,
          body: `${cedis(order.grandTotal)} confirmed`,
          at: order.paidAt,
          href: `/order/${order._id}`,
        });
      }
    }

    for (const alert of alerts) {
      const product =
        typeof alert.product === "string" ? null : (alert.product as ApiProduct);
      if (!product || product.price > alert.targetPrice) continue;

      list.push({
        id: `alert-${alert._id}`,
        icon: "trending-down-outline",
        title: "Price dropped",
        body: `${product.name} is now ${cedis(product.price)} at ${product.shopName} — your target was ${cedis(alert.targetPrice)}`,
        at: alert.lastNotifiedAt ?? alert.createdAt,
        href: `/product/${product._id}`,
      });
    }

    return list.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [orders, alerts]);

  const unreadCount = useMemo(
    () => items.filter((i) => new Date(i.at).getTime() > readAt).length,
    [items, readAt],
  );

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setReadAt(now);
    AsyncStorage.setItem(READ_KEY, String(now)).catch(() => {});
  }, []);

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unreadCount,
      loading,
      reload: () => setNonce((n) => n + 1),
      markAllRead,
    }),
    [items, unreadCount, loading, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used inside a NotificationsProvider");
  }
  return ctx;
};
