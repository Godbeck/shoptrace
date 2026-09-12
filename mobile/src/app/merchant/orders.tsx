/**
 * Screen 14 - Incoming orders. Real data from GET /api/orders/shop-orders.
 *
 * A merchant sees ONLY their own sub-order. The server strips the rest before
 * responding - there is no grandTotal and no other shop's items in the payload
 * at all, so this screen could not leak them even by accident.
 *
 * Status buttons only ever offer a transition the server's state machine would
 * accept, so a merchant never taps something and gets a 400 back.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { InkHeader, Tabs } from "@/components/headers";
import { Button, Card, Divider, EmptyState, ImageWell, StatusPill } from "@/components/ui";
import { colors, radius, spacing, type } from "@/theme";
import { cedis, distance, relativeTime } from "@/lib/format";
import { api, type ApiMerchantOrder } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import { canDecline, nextActionLabel, nextStatus, STATUS_META } from "@/lib/orderStatus";

const TABS = ["To pack", "Packed", "On the way", "Done"];

const groupFor = (s: string) => {
  // "pending" means unpaid, which a merchant never sees - shop-orders filters
  // on paid. Everything they do see starts at accepted.
  if (s === "pending" || s === "accepted") return "To pack";
  if (s === "packed") return "Packed";
  if (s === "out_for_delivery" || s === "ready_for_pickup") return "On the way";
  return "Done";
};

export default function MerchantOrders() {
  const insets = useSafeAreaInsets();
  const { notify, notifyError } = useSession();
  const [tab, setTab] = useState("To pack");
  const [working, setWorking] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => api.get<{ orders: ApiMerchantOrder[] }>("/orders/shop-orders?limit=50"),
    [],
    { refetchOnFocus: true },
  );

  const orders = data?.orders ?? [];
  const visible = orders.filter((o) => groupFor(o.subOrder.status) === tab);
  const newCount = orders.filter((o) => o.subOrder.status === "accepted").length;

  const advance = async (order: ApiMerchantOrder) => {
    const target = nextStatus(order.subOrder);
    if (!target) return;

    setWorking(order._id);
    try {
      await api.patch(`/orders/${order._id}/status`, { status: target });
      notify({
        title: `${order.orderNumber} → ${STATUS_META[target].merchantLabel}`,
        tone: "success",
      });
      reload();
    } catch (e) {
      notifyError(e, "Could not update that order");
    } finally {
      setWorking(null);
    }
  };

  /**
   * The escape hatch. Orders confirm themselves on payment, so this is how a
   * shop says "I do not actually have it" - usually because the last one was
   * sold over the counter and never updated here.
   *
   * It tells the server that too, which zeroes the stock so the next customer
   * is not sold the same phantom unit.
   */
  const cannotFulfil = async (order: ApiMerchantOrder) => {
    setWorking(order._id);
    try {
      await api.patch(`/orders/${order._id}/status`, {
        status: "declined",
        declineReason: "Out of stock",
        outOfStock: true,
      });
      notify({
        title: `${order.orderNumber} cancelled`,
        body: "The customer has been refunded and this product is now marked out of stock.",
      });
      reload();
    } catch (e) {
      notifyError(e, "Could not update that order");
    } finally {
      setWorking(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <InkHeader>
        <View style={styles.topRow}>
          <Text style={styles.title}>Orders</Text>
          <Pressable hitSlop={8} onPress={reload}>
            <Ionicons name="refresh-outline" size={20} color={colors.cream} />
          </Pressable>
        </View>
      </InkHeader>

      <Tabs
        items={TABS.map((t) => (t === "To pack" && newCount ? `To pack (${newCount})` : t))}
        value={tab === "To pack" && newCount ? `To pack (${newCount})` : tab}
        onChange={(next) => setTab(next.replace(/ \(\d+\)$/, ""))}
        surface="ink"
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.ink} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && orders.length === 0 ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 32 }} />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title={error} action="Pull down to retry" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title={`Nothing in ${tab.toLowerCase()}`}
            action="Paid orders for your shop land here"
          />
        ) : (
          visible.map((order) => {
            const sub = order.subOrder;
            const meta = STATUS_META[sub.status];
            const action = nextActionLabel(sub);
            const busy = working === order._id;

            return (
              <Card key={order._id} style={{ gap: 11 }}>
                <View style={styles.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.orderMeta}>
                      {relativeTime(order.createdAt)} ·{" "}
                      {sub.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}
                    </Text>
                  </View>
                  <StatusPill label={meta.merchantLabel} tone={meta.tone} />
                </View>

                <View style={styles.customerRow}>
                  <ImageWell size={32} icon="person-outline" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{order.customerName}</Text>
                    <Text style={styles.customerPhone}>{order.customerPhone}</Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      Linking.openURL(`tel:${order.customerPhone}`).catch(() => {})
                    }
                  >
                    <Ionicons name="call-outline" size={17} color={colors.ink} />
                  </Pressable>
                </View>

                <View style={styles.itemsBlock}>
                  {sub.items.map((item) => (
                    <View key={item.product} style={styles.itemLine}>
                      <Text style={styles.itemQty}>{item.quantity}×</Text>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>{cedis(item.lineTotal)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.deliveryRow}>
                  <Ionicons
                    name={
                      sub.deliveryMethod === "pickup"
                        ? "storefront-outline"
                        : "location-outline"
                    }
                    size={14}
                    color={colors.textTertiary}
                  />
                  <Text style={styles.deliveryText} numberOfLines={2}>
                    {sub.deliveryMethod === "pickup"
                      ? "Customer will pick up in store"
                      : `${order.deliveryAddress ?? "Address not given"} · ${distance(sub.distanceMeters ?? 0)}`}
                  </Text>
                </View>

                <Divider style={{ marginVertical: 0 }} />

                <View style={styles.foot}>
                  <Text style={styles.total}>{cedis(sub.subtotal)}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {canDecline(sub) ? (
                      <Button
                        label="Can't fulfil"
                        variant="danger"
                        small
                        disabled={busy}
                        onPress={() => cannotFulfil(order)}
                      />
                    ) : null}
                    <Button
                      label="Message"
                      variant="outline"
                      small
                      onPress={() =>
                        Linking.openURL(
                          `whatsapp://send?phone=233${order.customerPhone.slice(1)}`,
                        ).catch(() => notify({ title: "WhatsApp is not installed" }))
                      }
                    />
                    {action ? (
                      <Button
                        label={action}
                        small
                        loading={busy}
                        onPress={() => advance(order)}
                      />
                    ) : null}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { flex: 1, ...type.pageTitle, color: colors.cream },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  orderNumber: { ...type.cardTitle, color: colors.textPrimary },
  orderMeta: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  customerName: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  customerPhone: { fontSize: 10, color: colors.textTertiary },
  itemsBlock: {
    backgroundColor: colors.creamDeep,
    borderRadius: radius.button,
    padding: 11,
    gap: 7,
  },
  itemLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemQty: { fontSize: 11, fontWeight: "500", color: colors.textSecondary },
  itemName: { flex: 1, fontSize: 11, color: colors.textPrimary },
  itemPrice: { fontSize: 11, fontWeight: "500", color: colors.textPrimary },
  deliveryRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  deliveryText: { flex: 1, fontSize: 11, color: colors.textSecondary },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  total: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
});
