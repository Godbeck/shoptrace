/**
 * Screen 10 - Price alerts. Real alerts from GET /api/price-alerts.
 *
 * The progress bar is the point of the screen: it turns an abstract threshold
 * into something glanceable. "GH₵ 300 away" reads faster than two numbers.
 *
 * An alert fires when a merchant lowers the price past the target - the server
 * queues that job from the Product save hook. The bar tracks the real price
 * either way, so the screen is useful before notifications are delivered.
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
import { TabHeader, Tabs } from "@/components/headers";
import { Button, Card, EmptyState, ImageWell, StatusPill } from "@/components/ui";
import { colors, radius, spacing, status, type } from "@/theme";
import { cedis, relativeTime } from "@/lib/format";
import { api, type ApiPriceAlert, type ApiProduct } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import { SignInRequired } from "@/components/SignInRequired";

export default function PriceAlerts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signedIn, notify, notifyError } = useSession();
  const [tab, setTab] = useState("Active");

  const { data, loading, error, reload } = useAsync(
    async () =>
      signedIn
        ? api.get<{ alerts: ApiPriceAlert[] }>("/price-alerts")
        : { alerts: [] },
    [signedIn],
    { refetchOnFocus: true },
  );

  const alerts = data?.alerts ?? [];
  const visible = alerts.filter((a) =>
    tab === "Active" ? a.isActive : !a.isActive,
  );

  const remove = async (alert: ApiPriceAlert) => {
    try {
      await api.delete(`/price-alerts/${alert._id}`);
      notify({ title: "Alert removed" });
      reload();
    } catch (e) {
      notifyError(e);
    }
  };

  if (!signedIn) {
    return (
      <View style={{ flex: 1 }}>
        <TabHeader title="Price alerts" />
        <SignInRequired
          icon="notifications-outline"
          title="Watch a price"
          body="Tell us what you are willing to pay and we will let you know the moment a shop drops to it. You will need an account so we know where to reach you."
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TabHeader
        title="Price alerts"
        actions={[{ icon: "refresh-outline", onPress: reload }]}
      />
      <Tabs items={["Active", "Triggered"]} value={tab} onChange={setTab} />

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
        {loading && alerts.length === 0 ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 32 }} />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title={error} action="Pull down to retry" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title={tab === "Active" ? "No alerts running" : "Nothing has triggered yet"}
            action="Open a product and set a target price"
          />
        ) : (
          visible.map((alert) => {
            const product =
              typeof alert.product === "string" ? null : (alert.product as ApiProduct);
            const current = product?.price ?? alert.priceWhenSet;

            // How far the price has travelled from where it started toward the
            // target. Clamped, because a price can move the wrong way.
            const span = Math.max(alert.priceWhenSet - alert.targetPrice, 1);
            const travelled = alert.priceWhenSet - current;
            const progress = Math.min(Math.max(travelled / span, 0), 1);
            const away = Math.max(current - alert.targetPrice, 0);
            const hit = current <= alert.targetPrice;

            return (
              <Card key={alert._id} style={{ gap: 12 }}>
                <Pressable
                  style={styles.head}
                  onPress={() =>
                    product ? router.push(`/product/${product._id}`) : undefined
                  }
                >
                  <ImageWell size={48} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {product?.name ?? "Product"}
                    </Text>
                    <Text style={styles.meta}>
                      {product?.shopName ?? ""}
                      {product?.category ? ` · ${product.category}` : ""}
                    </Text>
                    <View style={styles.priceLine}>
                      <Text style={styles.current}>{cedis(current)}</Text>
                      <Ionicons name="arrow-forward" size={11} color={colors.textMuted} />
                      <Text style={styles.target}>
                        Alert at {cedis(alert.targetPrice)}
                      </Text>
                    </View>
                  </View>
                  <StatusPill
                    label={hit ? "Reached" : alert.isActive ? "Watching" : "Triggered"}
                    tone={hit || !alert.isActive ? "success" : "warning"}
                  />
                </Pressable>

                {hit ? (
                  <View style={styles.triggered}>
                    <Ionicons name="notifications" size={15} color={status.success.fg} />
                    <Text style={styles.triggeredText}>
                      Price dropped to {cedis(current)} at {product?.shopName}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
                    </View>
                    <View style={styles.trackLabels}>
                      <Text style={styles.trackLabel}>
                        {cedis(alert.targetPrice)} target
                      </Text>
                      <Text style={styles.trackLabel}>{cedis(away)} away</Text>
                    </View>
                  </View>
                )}

                <View style={styles.foot}>
                  <Text style={styles.setAt}>Set {relativeTime(alert.createdAt)}</Text>
                  <Pressable
                    onPress={() => remove(alert)}
                    hitSlop={8}
                    style={styles.removeButton}
                  >
                    <Ionicons name="trash-outline" size={13} color={status.danger.fg} />
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}

        <Button
          label="Find something to watch"
          icon="search-outline"
          full
          onPress={() => router.push("/customer/search")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { fontSize: 10, color: colors.textTertiary },
  priceLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  current: { fontSize: 13, fontWeight: "500", color: colors.textPrimary },
  target: { fontSize: 11, color: colors.textSecondary },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
  trackLabels: { flexDirection: "row", justifyContent: "space-between" },
  trackLabel: { fontSize: 9, color: colors.textTertiary },
  triggered: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: status.success.bg,
    borderRadius: radius.button,
    padding: 10,
  },
  triggeredText: { flex: 1, fontSize: 11, color: status.success.fg },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  setAt: { fontSize: 10, color: colors.textTertiary },
  removeButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  removeText: { fontSize: 11, fontWeight: "500", color: status.danger.fg },
});
