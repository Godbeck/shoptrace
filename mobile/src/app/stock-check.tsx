/**
 * Stock check.
 *
 * The cheap half of keeping stock honest. Every product the merchant has not
 * vouched for in over a week, each with a minus / plus / "still right" so a
 * whole shop can be confirmed in under a minute.
 *
 * This exists because the expensive half - failing an order and refunding a
 * customer - is a terrible way to discover that a count was wrong.
 */
import { useEffect, useState } from "react";
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
import { iconForCategory } from "@/components/cards";
import { Button, Card, EmptyState, ImageWell } from "@/components/ui";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { cedis, relativeTime } from "@/lib/format";
import { api, type ApiProduct } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { useSession } from "@/lib/session";

export default function StockCheck() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notify, notifyError } = useSession();

  const { data, loading, error, reload } = useAsync(
    () => api.get<{ products: ApiProduct[]; count: number; cutoffDays: number }>(
      "/products/stale",
    ),
    [],
    { refetchOnFocus: true },
  );

  /** Local edits before they are sent, keyed by product id. */
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const p of data?.products ?? []) next[p._id] = p.stockCount;
    setCounts(next);
  }, [data]);

  const bump = (id: string, delta: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));

  const confirm = async (product: ApiProduct) => {
    setWorking(product._id);
    try {
      await api.patch(`/products/${product._id}/confirm-stock`, {
        stockCount: counts[product._id] ?? product.stockCount,
      });
      setDone((d) => [...d, product._id]);
      notify({ title: `${product.name} confirmed`, tone: "success" });
    } catch (e) {
      notifyError(e, "Could not confirm that product");
    } finally {
      setWorking(null);
    }
  };

  const confirmAll = async () => {
    const pending = (data?.products ?? []).filter((p) => !done.includes(p._id));
    if (pending.length === 0) return;

    setWorking("all");
    try {
      // Sequential on purpose: a shop on mobile data does better with a queue
      // than with twenty parallel requests.
      for (const p of pending) {
        await api.patch(`/products/${p._id}/confirm-stock`, {
          stockCount: counts[p._id] ?? p.stockCount,
        });
      }
      setDone((d) => [...d, ...pending.map((p) => p._id)]);
      notify({
        title: `${pending.length} products confirmed`,
        body: "Customers see your real numbers again.",
        tone: "success",
      });
    } catch (e) {
      notifyError(e, "Could not confirm everything");
    } finally {
      setWorking(null);
    }
  };

  const products = data?.products ?? [];
  const remaining = products.filter((p) => !done.includes(p._id));

  return (
    <View style={{ flex: 1 }}>
      <InkHeader>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.cream} />
          </Pressable>
          <Text style={styles.title}>Stock check</Text>
          <Pressable onPress={reload} hitSlop={8}>
            <Ionicons name="refresh-outline" size={19} color={colors.cream} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          These have not been confirmed in over a week, so customers are being
          shown "check availability" instead of your numbers.
        </Text>
      </InkHeader>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 8,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.ink} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && products.length === 0 ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 32 }} />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title={error} action="Pull down to retry" />
        ) : remaining.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="Everything is up to date"
            action="Your stock numbers are being shown to customers in full"
          />
        ) : (
          <>
            {remaining.map((product) => {
              const value = counts[product._id] ?? product.stockCount;
              const changed = value !== product.stockCount;
              const busy = working === product._id || working === "all";

              return (
                <Card key={product._id} style={{ gap: 12 }}>
                  <View style={styles.row}>
                    <ImageWell size={46} icon={iconForCategory(product.category)} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text style={styles.meta}>
                        {cedis(product.price)} · last confirmed{" "}
                        {product.stockConfirmedAt
                          ? relativeTime(product.stockConfirmedAt)
                          : "never"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.countRow}>
                    <Pressable
                      onPress={() => bump(product._id, -1)}
                      hitSlop={6}
                      style={styles.stepButton}
                    >
                      <Ionicons name="remove" size={16} color={colors.ink} />
                    </Pressable>

                    <View style={styles.countValue}>
                      <Text style={styles.countText}>{value}</Text>
                      <Text style={styles.countLabel}>in stock</Text>
                    </View>

                    <Pressable
                      onPress={() => bump(product._id, 1)}
                      hitSlop={6}
                      style={styles.stepButton}
                    >
                      <Ionicons name="add" size={16} color={colors.ink} />
                    </Pressable>

                    <Button
                      label={changed ? "Save" : "Still right"}
                      small
                      style={{ flex: 1 }}
                      loading={busy}
                      onPress={() => confirm(product)}
                    />
                  </View>
                </Card>
              );
            })}

            <Button
              label={`Confirm all ${remaining.length} as correct`}
              variant="outline"
              full
              icon="checkmark-done-outline"
              loading={working === "all"}
              onPress={confirmAll}
            />

            <Text style={styles.footnote}>
              Confirming does not change anything for customers except that they
              see your numbers again. If you are not sure, set it lower - an
              order you cannot fill costs more than a sale you missed.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, ...type.pageTitle, color: colors.cream },
  subtitle: { fontSize: 11, color: "rgba(253,240,213,0.60)", lineHeight: 16 },
  row: { flexDirection: "row", gap: 11, alignItems: "center" },
  name: { ...type.cardTitle, color: colors.textPrimary },
  meta: { fontSize: 10, color: colors.textTertiary },
  countRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  countValue: { alignItems: "center", minWidth: 54 },
  countText: { fontSize: 17, fontWeight: "500", color: colors.textPrimary },
  countLabel: { fontSize: 9, color: colors.textTertiary },
  footnote: {
    fontSize: 10,
    color: colors.textTertiary,
    lineHeight: 15,
    paddingHorizontal: 2,
  },
});
