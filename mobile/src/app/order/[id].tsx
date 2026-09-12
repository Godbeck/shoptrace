/**
 * Screen 8 - Order tracking. Real order from GET /api/orders/:id.
 *
 * One timeline PER SHOP, because sub-orders progress independently on the
 * server. Refetches on focus and on pull, so the merchant's status changes
 * appear here.
 */
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/headers";
import { Button, Card, Divider, EmptyState, ImageWell, StatusPill } from "@/components/ui";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { cedis, relativeTime } from "@/lib/format";
import { api, type ApiOrder } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import { flowFor, overallStatus, STATUS_META } from "@/lib/orderStatus";

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notify, notifyError } = useSession();

  const { data: order, loading, error, reload } = useAsync(
    () => api.get<ApiOrder>(`/orders/${id}`),
    [id],
    { refetchOnFocus: true },
  );

  const payNow = async () => {
    if (!order) return;
    try {
      await api.post(`/payments/mock-pay/${order._id}`, { channel: "mobile_money" });
      notify({ title: "Payment recorded", tone: "success" });
      reload();
    } catch (e) {
      notifyError(e, "Could not record the payment");
    }
  };

  const cancel = async () => {
    if (!order) return;
    try {
      await api.patch(`/orders/${order._id}/cancel`);
      notify({ title: "Order cancelled", body: "Stock has gone back to the shop." });
      reload();
    } catch (e) {
      // The server refuses once a shop has started work, and says why.
      notifyError(e, "Could not cancel this order");
    }
  };

  if (loading && !order) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Order tracking" />
        <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Order tracking" />
        <EmptyState
          icon="cloud-offline-outline"
          title={error ?? "Order not found"}
          action="Go back to your orders and try again"
        />
      </View>
    );
  }

  const state = overallStatus(order.subOrders);
  const lead = order.subOrders[0];
  const leadMeta = STATUS_META[lead.status];
  const cancellable = order.subOrders.some(
    (s) => s.status === "pending" || s.status === "accepted",
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Order tracking"
        trailingText={order.orderNumber}
        actions={[{ icon: "refresh-outline", onPress: reload }]}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.ink} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={leadMeta.icon as any} size={28} color={colors.cream} />
          </View>
          <Text style={styles.heroTitle}>{state.label}</Text>
          <Text style={styles.heroSub}>
            {order.subOrders.length > 1
              ? `${order.subOrders.length} shops are fulfilling this order separately`
              : `${lead.shopName} is handling your order`}
          </Text>
          <View style={styles.estimateChip}>
            <Ionicons name="time-outline" size={12} color={colors.ink} />
            <Text style={styles.estimateText}>
              {lead.deliveryMethod === "pickup"
                ? "Collect from the shop"
                : (lead.deliveryEstimate ?? "Delivery estimate pending")}
            </Text>
          </View>
        </View>

        <View style={{ padding: spacing.gutter, gap: 10 }}>
          {order.paymentStatus === "unpaid" ? (
            <Card style={{ gap: 11 }}>
              <View style={styles.unpaidRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.ink} />
                <Text style={styles.unpaidText}>
                  This order is not paid yet. The shop only sees it once
                  payment goes through, so finish up to confirm it.
                </Text>
              </View>
              <Button
                label={`Pay ${cedis(order.grandTotal)}`}
                full
                icon="lock-closed-outline"
                onPress={payNow}
              />
            </Card>
          ) : null}

          {/* One card per shop - they progress independently. */}
          {order.subOrders.map((sub) => {
            const flow = flowFor(sub);
            const reached = new Set(sub.statusHistory.map((h) => h.status));
            const isDead = sub.status === "cancelled" || sub.status === "declined";

            return (
              <Card key={sub._id ?? sub.shop} style={{ gap: 14 }}>
                <View style={styles.timelineHead}>
                  <Ionicons name="storefront-outline" size={14} color={colors.ink} />
                  <Text style={styles.timelineShop}>{sub.shopName}</Text>
                  <StatusPill
                    label={STATUS_META[sub.status].label}
                    tone={STATUS_META[sub.status].tone}
                  />
                </View>

                {isDead ? (
                  <View style={styles.deadRow}>
                    <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                    <Text style={styles.deadText}>
                      {sub.declineReason ??
                        sub.statusHistory[sub.statusHistory.length - 1]?.note ??
                        "This part of the order did not go ahead."}
                    </Text>
                  </View>
                ) : (
                  flow.map((stage, i) => {
                    const done = reached.has(stage);
                    const current = sub.status === stage;
                    const entry = sub.statusHistory.find((h) => h.status === stage);
                    const last = i === flow.length - 1;

                    return (
                      <View key={stage} style={styles.node}>
                        <View style={styles.nodeRail}>
                          <View
                            style={[
                              styles.nodeCircle,
                              done && !current && { backgroundColor: colors.ink },
                              current && {
                                backgroundColor: colors.cream,
                                borderWidth: 2,
                                borderColor: colors.ink,
                              },
                              !done && !current && { backgroundColor: colors.borderLight },
                            ]}
                          >
                            <Ionicons
                              name={
                                (done && !current
                                  ? "checkmark"
                                  : STATUS_META[stage].icon) as any
                              }
                              size={14}
                              color={
                                done && !current
                                  ? colors.cream
                                  : current
                                    ? colors.ink
                                    : colors.textMuted
                              }
                            />
                          </View>
                          {!last ? (
                            <View
                              style={[
                                styles.nodeLine,
                                {
                                  backgroundColor: reached.has(flow[i + 1])
                                    ? colors.ink
                                    : colors.border,
                                },
                              ]}
                            />
                          ) : null}
                        </View>

                        <View style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
                          <Text
                            style={[
                              styles.nodeTitle,
                              !done && { color: colors.textTertiary },
                            ]}
                          >
                            {STATUS_META[stage].label}
                          </Text>
                          {entry ? (
                            <Text style={styles.nodeTime}>{relativeTime(entry.at)}</Text>
                          ) : null}
                          {entry?.note ? (
                            <Text style={styles.nodeNote}>{entry.note}</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}

                <Divider style={{ marginVertical: 0 }} />

                {sub.items.map((item) => (
                  <View key={item.product} style={styles.itemRow}>
                    <ImageWell size={40} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {item.quantity} × {cedis(item.price)}
                      </Text>
                    </View>
                    <Text style={styles.itemPrice}>{cedis(item.lineTotal)}</Text>
                  </View>
                ))}

                <View style={{ flexDirection: "row", gap: 9 }}>
                  <Button
                    label="Call shop"
                    variant="outline"
                    small
                    icon="call-outline"
                    style={{ flex: 1 }}
                    onPress={() => Linking.openURL(`tel:${sub.shopPhone}`).catch(() => {})}
                  />
                  <Button
                    label="WhatsApp"
                    variant="outline"
                    small
                    icon="logo-whatsapp"
                    style={{ flex: 1 }}
                    onPress={() =>
                      Linking.openURL(
                        `whatsapp://send?phone=233${sub.shopPhone.slice(1)}`,
                      ).catch(() => notify({ title: "WhatsApp is not installed" }))
                    }
                  />
                </View>
              </Card>
            );
          })}

          <Card style={{ gap: 9 }}>
            <Text style={styles.cardTitle}>Payment</Text>
            <SummaryRow label="Subtotal" value={cedis(order.itemsTotal)} />
            <SummaryRow
              label="Delivery"
              value={order.deliveryTotal === 0 ? "Free" : cedis(order.deliveryTotal)}
            />
            <SummaryRow label="Platform fee" value={cedis(order.platformFee)} />
            <Divider style={{ marginVertical: 2 }} />
            <SummaryRow label="Total" value={cedis(order.grandTotal)} strong />
            <View style={styles.methodRow}>
              <Ionicons name="phone-portrait-outline" size={13} color={colors.textTertiary} />
              <Text style={styles.methodText}>
                {order.paymentStatus === "paid"
                  ? `Paid with ${order.paymentMethod === "momo" ? "Mobile Money" : (order.paymentMethod ?? "card")}`
                  : order.paymentStatus === "refunded"
                    ? "Refunded"
                    : "Awaiting payment"}
              </Text>
            </View>
          </Card>

          {cancellable ? (
            <Button
              label="Cancel this order"
              variant="danger"
              full
              icon="close-circle-outline"
              onPress={cancel}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const SummaryRow = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text>
    <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.cream,
    alignItems: "center",
    paddingBottom: 24,
    paddingHorizontal: spacing.screen,
    gap: 7,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.panel,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 4 },
  heroSub: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  estimateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  estimateText: { fontSize: 11, fontWeight: "500", color: colors.ink },
  unpaidRow: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  unpaidText: { flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  timelineHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  timelineShop: { flex: 1, ...type.cardTitle, color: colors.textPrimary },
  node: { flexDirection: "row", gap: 12 },
  nodeRail: { alignItems: "center" },
  nodeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeLine: { width: 1.5, flex: 1, minHeight: 18 },
  nodeTitle: { ...type.cardTitle, color: colors.textPrimary },
  nodeTime: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  nodeNote: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
  deadRow: { flexDirection: "row", gap: 9, alignItems: "center" },
  deadText: { flex: 1, fontSize: 12, color: colors.textSecondary },
  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  itemName: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  itemMeta: { fontSize: 10, color: colors.textTertiary },
  itemPrice: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValue: { fontSize: 12, color: colors.textPrimary },
  summaryStrong: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  methodText: { fontSize: 11, color: colors.textTertiary },
});
