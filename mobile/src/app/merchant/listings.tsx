/**
 * Screen 12 - My listings. Real products from GET /api/products/my-products.
 *
 * The subscription limit is surfaced here rather than only at the moment of
 * failure, so a merchant can see they are near the ceiling before they write a
 * whole product and get a 403.
 */
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { InkHeader } from "@/components/headers";
import { iconForCategory } from "@/components/cards";
import { Button, Card, Chip, EmptyState, ImageWell, StatusPill } from "@/components/ui";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { cedis } from "@/lib/format";
import { api, type ApiProduct } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import type { MerchantSummary } from "@/lib/merchantTypes";

export default function Listings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notify, notifyError } = useSession();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const { data, loading, error, reload } = useAsync(
    () => api.get<{ products: ApiProduct[] }>("/products/my-products"),
    [],
    { refetchOnFocus: true },
  );
  const summary = useAsync(
    () => api.get<MerchantSummary>("/merchant/summary?days=30"),
    [],
    { refetchOnFocus: true },
  );

  const products = data?.products ?? [];
  const limit = summary.data?.stats.productLimit;

  const stockLabel = (p: ApiProduct) => {
    if (p.stockCount === 0) return { label: "Out of stock", tone: "danger" as const };
    if (p.stockCount <= 5) return { label: "Low stock", tone: "warning" as const };
    return { label: "In stock", tone: "success" as const };
  };

  const filtered = useMemo(() => {
    let list = products;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));

    if (filter === "In stock") list = list.filter((p) => p.stockCount > 5);
    if (filter === "Low stock")
      list = list.filter((p) => p.stockCount > 0 && p.stockCount <= 5);
    if (filter === "Out of stock") list = list.filter((p) => p.stockCount === 0);
    if (filter === "Featured") list = list.filter((p) => p.isFeatured);

    return list;
  }, [products, query, filter]);

  const softDelete = async (product: ApiProduct) => {
    try {
      await api.delete(`/products/${product._id}`);
      notify({
        title: `${product.name} removed`,
        body: "It is hidden from customers but kept on past orders.",
      });
      reload();
    } catch (e) {
      notifyError(e, "Could not remove that product");
    }
  };

  const FILTERS = [
    `All (${products.length})`,
    "In stock",
    "Low stock",
    "Out of stock",
    "Featured",
  ];

  return (
    <View style={{ flex: 1 }}>
      <InkHeader>
        <View style={styles.topRow}>
          <Text style={styles.title}>My listings</Text>
          <Pressable hitSlop={8} onPress={() => router.push("/product-form")}>
            <Ionicons name="add" size={22} color={colors.cream} />
          </Pressable>
          <Pressable hitSlop={8} onPress={reload}>
            <Ionicons name="refresh-outline" size={19} color={colors.cream} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={15} color="rgba(253,240,213,0.55)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your products"
            placeholderTextColor="rgba(253,240,213,0.45)"
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {FILTERS.map((f) => {
            const key = f.startsWith("All") ? "All" : f;
            return (
              <Chip
                key={f}
                label={f}
                active={filter === key}
                onSurface="ink"
                onPress={() => setFilter(key)}
              />
            );
          })}
        </ScrollView>
      </InkHeader>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 80,
          gap: 8,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.ink} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            <Text style={styles.summaryStrong}>{filtered.length} products</Text>
            {limit ? ` of ${limit} allowed` : " listed"}
          </Text>
          {limit && products.length >= limit ? (
            <StatusPill label="Limit reached" tone="warning" />
          ) : null}
        </View>

        {loading && products.length === 0 ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 32 }} />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title={error} action="Pull down to retry" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="pricetags-outline"
            title={products.length === 0 ? "Nothing listed yet" : "Nothing matches that"}
            action={
              products.length === 0
                ? "Tap Add product to list your first item"
                : "Try a different filter"
            }
          />
        ) : (
          filtered.map((p) => {
            const stock = stockLabel(p);
            return (
              <Card key={p._id}>
                <View style={styles.row}>
                  <View>
                    <ImageWell size={52} icon={iconForCategory(p.category)} />
                    {p.stockCount === 0 ? (
                      <View style={styles.outBadge}>
                        <Text style={styles.outBadgeText}>Out</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.category}>
                      {p.category}
                      {p.brand ? ` · ${p.brand}` : ""}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{cedis(p.price)}</Text>
                      <StatusPill label={stock.label} tone={stock.tone} />
                    </View>
                  </View>

                  <View style={styles.rightCol}>
                    <View style={styles.viewRow}>
                      <Ionicons name="eye-outline" size={12} color={colors.textTertiary} />
                      <Text style={styles.viewCount}>{p.viewCount}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable
                        style={styles.iconButton}
                        onPress={() => router.push(`/product-form?id=${p._id}`)}
                      >
                        <Ionicons name="pencil" size={13} color={colors.ink} />
                      </Pressable>
                      <Pressable
                        style={styles.iconButton}
                        onPress={() => softDelete(p)}
                      >
                        <Ionicons name="trash-outline" size={13} color={colors.ink} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 74 }]}
        onPress={() => router.push("/product-form")}
      >
        <Ionicons name="add" size={17} color={colors.cream} />
        <Text style={styles.fabText}>Add product</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { flex: 1, ...type.pageTitle, color: colors.cream },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: radius.input,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.cream },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  summaryText: { fontSize: 12, color: colors.textSecondary },
  summaryStrong: { fontWeight: "500", color: colors.textPrimary },
  row: { flexDirection: "row", gap: 11, alignItems: "center" },
  outBadge: {
    position: "absolute",
    bottom: -3,
    left: -3,
    backgroundColor: colors.ink,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  outBadgeText: { fontSize: 8, fontWeight: "500", color: colors.cream },
  name: { ...type.cardTitle, color: colors.textPrimary },
  category: { fontSize: 10, color: colors.textTertiary },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  price: { ...type.priceCard, color: colors.textPrimary },
  rightCol: { alignItems: "flex-end", gap: 8 },
  viewRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  viewCount: { fontSize: 10, color: colors.textTertiary },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  fabText: { fontSize: 13, fontWeight: "500", color: colors.cream },
});
