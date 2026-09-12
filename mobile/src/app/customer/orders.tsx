/**
 * Screen 9 - My orders. Real orders from GET /api/orders/my-orders.
 *
 * Refetches whenever the screen comes into focus, so a merchant accepting an
 * order shows up here without the customer doing anything but coming back to
 * the tab.
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
import { TabHeader, Tabs } from "@/components/headers";
import { Card, Divider, EmptyState, ImageWell, StatusPill } from "@/components/ui";
import { colors, spacing, type } from "@/theme";
import { cedis, relativeTime } from "@/lib/format";
import { api, type ApiOrder } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { overallStatus } from "@/lib/orderStatus";
import { useSession } from "@/lib/session";
import { SignInRequired } from "@/components/SignInRequired";

const TABS = ["All", "Active", "Delivered", "Cancelled"];

export default function MyOrders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("All");
  const { signedIn } = useSession();

  const { data, loading, error, reload } = useAsync(
    // A guest has no orders, and asking a protected endpoint without a token
    // just earns a 401 the screen would never show.
    async () =>
      signedIn
        ? api.get<{ orders: ApiOrder[] }>("/orders/my-orders?limit=50")
        : { orders: [] },
    [signedIn],
    { refetchOnFocus: true },
  );

  const orders = data?.orders ?? [];
  const visible =
    tab === "All"
      ? orders
      : orders.filter((o) => overallStatus(o.subOrders).group === tab);

  if (!signedIn) {
    return (
      <View style={{ flex: 1 }}>
        <TabHeader title="My orders" />
        <SignInRequired
          icon="receipt-outline"
          title="Keep track of your orders"
          body="Once you have an account you can follow every order from the moment a shop confirms it to the moment it reaches you."
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TabHeader title="My orders" actions={[{ icon: "refresh-outline", onPress: reload }]} />
      <Tabs items={TABS} value={tab} onChange={setTab} />

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
          <EmptyState
            icon="cloud-offline-outline"
            title={error}
            action="Pull down to try again"
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title={tab === "All" ? "No orders yet" : `No ${tab.toLowerCase()} orders`}
            action="Add something to your cart and check out"
          />
        ) : (
          visible.map((order) => {
            const state = overallStatus(order.subOrders);
            const allItems = order.subOrders.flatMap((s) => s.items);
            const first = allItems[0];
            const extra = allItems.length - 1;

            return (
              <Card key={order._id} style={{ gap: 11 }}>
                <View style={styles.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.timestamp}>
                      {relativeTime(order.createdAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    <StatusPill label={state.label} tone={state.tone} />
                    {order.paymentStatus !== "paid" ? (
                      <StatusPill
                        label={order.paymentStatus === "unpaid" ? "Unpaid" : order.paymentStatus}
                        tone={order.paymentStatus === "unpaid" ? "warning" : "danger"}
                      />
                    ) : null}
                  </View>
                </View>

                {first ? (
                  <View style={styles.itemRow}>
                    <ImageWell size={46} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {first.name}
                      </Text>
                      <Text style={styles.itemShop}>
                        {order.subOrders[0].shopName}
                        {order.subOrders.length > 1
                          ? ` + ${order.subOrders.length - 1} more ${
                              order.subOrders.length === 2 ? "shop" : "shops"
                            }`
                          : ""}
                      </Text>
                      {extra > 0 ? (
                        <Text style={styles.more}>
                          + {extra} more {extra === 1 ? "item" : "items"}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <Divider style={{ marginVertical: 0 }} />

                <View style={styles.foot}>
                  <Text style={styles.total}>{cedis(order.grandTotal)}</Text>
                  <Pressable
                    onPress={() => router.push(`/order/${order._id}`)}
                    hitSlop={8}
                  >
                    <Text style={styles.link}>
                      {state.group === "Active" ? "Track order" : "View details"}
                    </Text>
                  </Pressable>
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
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  orderNumber: { ...type.cardTitle, color: colors.textPrimary },
  timestamp: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  itemRow: { flexDirection: "row", gap: 11, alignItems: "center" },
  itemName: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  itemShop: { fontSize: 10, color: colors.textTertiary },
  more: { fontSize: 10, color: colors.textMuted },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  total: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  link: { fontSize: 12, fontWeight: "500", color: colors.ink },
});
