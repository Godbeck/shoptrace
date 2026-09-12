/**
 * Screen 11 - Merchant home. Real figures from GET /api/merchant/summary.
 *
 * Every number here is computed from actual paid orders on the server, not
 * from a stored counter - so it cannot drift out of step with the orders.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { InkHeader } from "@/components/headers";
import { Button, Card, Chip, EmptyState, ImageWell, StatusPill } from "@/components/ui";
import { borderWidth, colors, radius, spacing, status, type } from "@/theme";
import { cedis, relativeTime } from "@/lib/format";
import { api, type ApiMerchantOrder } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { useShop } from "@/lib/shop";
import { useSession } from "@/lib/session";
import type { MerchantSummary } from "@/lib/merchantTypes";

const PERIODS = [
  { label: "Today", days: 1 },
  { label: "This week", days: 7 },
  { label: "This month", days: 30 },
];

export default function MerchantHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shop } = useShop();
  const { notify, notifyError } = useSession();
  const [period, setPeriod] = useState(PERIODS[2]);
  const [working, setWorking] = useState<string | null>(null);

  const summary = useAsync(
    () => api.get<MerchantSummary>(`/merchant/summary?days=${period.days}`),
    [period.days],
    { refetchOnFocus: true },
  );

  // Orders confirm themselves on payment, so the dashboard queue is what is
  // waiting to be PACKED, not what is waiting to be accepted.
  const queue = useAsync(
    () => api.get<{ orders: ApiMerchantOrder[] }>("/orders/shop-orders?status=accepted"),
    [],
    { refetchOnFocus: true },
  );

  const stats = summary.data?.stats;
  const newOrders = queue.data?.orders ?? [];
  const byDay = summary.data?.byDay ?? [];
  const peak = byDay.length ? Math.max(...byDay.map((d) => d.revenue)) : 0;

  const act = async (order: ApiMerchantOrder, action: "pack" | "cannotFulfil") => {
    setWorking(order._id);
    try {
      await api.patch(`/orders/${order._id}/status`, {
        status: action === "pack" ? "packed" : "declined",
        ...(action === "cannotFulfil"
          ? { declineReason: "Out of stock", outOfStock: true }
          : {}),
      });
      notify({
        title:
          action === "pack"
            ? `${order.orderNumber} marked packed`
            : `${order.orderNumber} cancelled`,
        body:
          action === "cannotFulfil"
            ? "The customer has been refunded and this product is now marked out of stock."
            : undefined,
        tone: action === "pack" ? "success" : undefined,
      });
      queue.reload();
      summary.reload();
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
          <View style={styles.avatarWell}>
            <Ionicons name="storefront" size={17} color={colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName} numberOfLines={1}>
              {shop?.name ?? "Your shop"}
            </Text>
            <View style={styles.statusLine}>
              <View style={styles.greenDot} />
              <Text style={styles.statusText} numberOfLines={1}>
                Verified · {shop?.address ?? ""}
              </Text>
            </View>
          </View>
          <Pressable hitSlop={8} onPress={() => router.push("/merchant/settings")}>
            <Ionicons name="settings-outline" size={20} color={colors.cream} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {PERIODS.map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              active={p.label === period.label}
              onSurface="ink"
              onPress={() => setPeriod(p)}
            />
          ))}
        </ScrollView>
      </InkHeader>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl
            refreshing={summary.loading}
            onRefresh={() => {
              summary.reload();
              queue.reload();
            }}
            tintColor={colors.ink}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {summary.loading && !stats ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 32 }} />
        ) : summary.error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={summary.error}
            action="Pull down to try again"
          />
        ) : (
          <>
            <View style={styles.statGrid}>
              <Stat label="Revenue" value={cedis(stats?.revenue ?? 0)} icon="cash-outline" />
              <Stat label="Orders" value={String(stats?.orders ?? 0)} icon="receipt-outline" />
              <Stat label="Product views" value={String(stats?.views ?? 0)} icon="eye-outline" />
              <Stat
                label="Average order"
                value={cedis(stats?.averageOrder ?? 0)}
                icon="trending-up-outline"
              />
            </View>

            {stats && stats.staleStock > 0 ? (
              <Card style={{ gap: 10 }}>
                <View style={styles.attentionHead}>
                  <View style={styles.attentionWell}>
                    <Ionicons name="time-outline" size={16} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardTitle}>
                      {stats.staleStock}{" "}
                      {stats.staleStock === 1 ? "product needs" : "products need"} a
                      stock check
                    </Text>
                    <Text style={styles.attentionSub}>
                      Customers see "check availability" instead of a number until
                      you confirm these.
                    </Text>
                  </View>
                </View>
                <Button
                  label="Check stock"
                  small
                  full
                  icon="checkmark-done-outline"
                  onPress={() => router.push("/stock-check")}
                />
              </Card>
            ) : null}

            {stats && (stats.outOfStock > 0 || stats.lowStock > 0) ? (
              <Card style={{ gap: 9 }}>
                <Text style={styles.cardTitle}>Needs attention</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {stats.outOfStock > 0 ? (
                    <StatusPill
                      label={`${stats.outOfStock} out of stock`}
                      tone="danger"
                    />
                  ) : null}
                  {stats.lowStock > 0 ? (
                    <StatusPill label={`${stats.lowStock} low on stock`} tone="warning" />
                  ) : null}
                  {stats.fulfilmentRate !== null ? (
                    <StatusPill
                      label={`${stats.fulfilmentRate}% fulfilled`}
                      tone={stats.fulfilmentRate >= 80 ? "success" : "warning"}
                    />
                  ) : null}
                </View>
                <Button
                  label="Open listings"
                  variant="outline"
                  small
                  onPress={() => router.push("/merchant/listings")}
                />
              </Card>
            ) : null}

            {byDay.length > 0 ? (
              <Card style={{ gap: 12 }}>
                <Text style={styles.cardTitle}>
                  Revenue · {period.label.toLowerCase()}
                </Text>
                <View style={styles.chart}>
                  {byDay.slice(-7).map((d) => (
                    <View key={d.date} style={styles.barColumn}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: 8 + (peak ? (d.revenue / peak) * 62 : 0),
                            backgroundColor:
                              d.revenue === peak && peak > 0
                                ? colors.ink
                                : colors.border,
                          },
                        ]}
                      />
                      <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>
                To pack ({newOrders.length})
              </Text>
              <Pressable onPress={() => router.push("/merchant/orders")} hitSlop={8}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>

            {newOrders.length === 0 ? (
              <Card>
                <Text style={styles.quiet}>
                  Nothing to pack. Paid orders confirm themselves and land here.
                </Text>
              </Card>
            ) : (
              newOrders.map((order) => (
                <Card key={order._id} style={{ gap: 11 }}>
                  <View style={styles.orderHead}>
                    <ImageWell size={34} icon="person-outline" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerName}>{order.customerName}</Text>
                      <Text style={styles.orderMeta}>
                        {order.orderNumber} · {relativeTime(order.createdAt)}
                      </Text>
                    </View>
                    <StatusPill label="To pack" tone="info" />
                  </View>

                  <Text style={styles.itemsLine} numberOfLines={2}>
                    {order.subOrder.items
                      .map((i) => `${i.quantity} × ${i.name}`)
                      .join(", ")}
                  </Text>

                  <View style={styles.orderFoot}>
                    <Text style={styles.orderTotal}>
                      {cedis(order.subOrder.subtotal)}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button
                        label="Can't fulfil"
                        variant="danger"
                        small
                        disabled={working === order._id}
                        onPress={() => act(order, "cannotFulfil")}
                      />
                      <Button
                        label="Start packing"
                        small
                        loading={working === order._id}
                        onPress={() => act(order, "pack")}
                      />
                    </View>
                  </View>
                </Card>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Quick actions</Text>
            <View style={styles.statGrid}>
              <QuickAction
                icon="add-circle-outline"
                label="Add product"
                sub="List something new"
                onPress={() => router.push("/product-form")}
              />
              <QuickAction
                icon="pricetags-outline"
                label="My listings"
                sub={`${stats?.products ?? 0} live`}
                onPress={() => router.push("/merchant/listings")}
              />
              <QuickAction
                icon="bar-chart-outline"
                label="Analytics"
                sub="Views and revenue"
                onPress={() => router.push("/merchant/analytics")}
              />
              <QuickAction
                icon="settings-outline"
                label="Shop settings"
                sub="Delivery, hours"
                onPress={() => router.push("/merchant/settings")}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const Stat = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) => (
  <View style={styles.statCard}>
    <View style={styles.statTop}>
      <Text style={styles.statLabel}>{label}</Text>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
    </View>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const QuickAction = ({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub: string;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={styles.statCard}>
    <View style={styles.actionWell}>
      <Ionicons name={icon} size={16} color={colors.ink} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
    <Text style={styles.actionSub}>{sub}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarWell: {
    width: 36,
    height: 36,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: { fontSize: 14, fontWeight: "500", color: colors.cream },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: status.success.fg },
  statusText: { flex: 1, fontSize: 10, color: "rgba(253,240,213,0.60)" },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  statCard: {
    width: "48.6%",
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    padding: spacing.card,
    gap: 5,
  },
  statTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statLabel: { fontSize: 10, color: colors.textTertiary },
  statValue: { fontSize: 20, fontWeight: "500", color: colors.textPrimary },
  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
  attentionHead: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  attentionWell: {
    width: 34,
    height: 34,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  attentionSub: { fontSize: 10.5, color: colors.textTertiary, lineHeight: 15 },
  quiet: { fontSize: 12, color: colors.textTertiary },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 96,
  },
  barColumn: { alignItems: "center", gap: 6, flex: 1 },
  bar: { width: 16, borderRadius: 3 },
  barLabel: { fontSize: 8, color: colors.textMuted },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionTitle: { ...type.sectionHeader, color: colors.textPrimary },
  seeAll: { fontSize: 12, fontWeight: "500", color: colors.ink },
  orderHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  customerName: { ...type.cardTitle, color: colors.textPrimary },
  orderMeta: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  itemsLine: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  orderFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  orderTotal: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  actionWell: {
    width: 32,
    height: 32,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  actionLabel: { fontSize: 12.5, fontWeight: "500", color: colors.textPrimary },
  actionSub: { fontSize: 10, color: colors.textTertiary },
});
