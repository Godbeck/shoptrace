/**
 * Screen 4 - Search results. Real search from GET /api/products/search.
 *
 * The tiered grouping is the point: results sit under "Near you" and
 * "Elsewhere in Accra", with anything past the city band collapsed behind a
 * single savings line. A large saving 14km away must never be hidden, because
 * hiding it would defeat the app.
 *
 * Note the server uses $regex on name for location search, not $text -
 * $geoNear has to be the first pipeline stage and $text is only allowed there
 * too, so the two cannot be combined.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CreamHeader } from "@/components/headers";
import { CartButton } from "@/components/CartButton";
import { ProductCard } from "@/components/cards";
import { Chip, EmptyState } from "@/components/ui";
import { borderWidth, colors, radius, spacing } from "@/theme";
import { cedis } from "@/lib/format";
import { api, type ApiProduct } from "@/lib/api";
import { useAsync, useCoords } from "@/lib/useApi";
import { groupByProduct } from "@/lib/adapt";
import type { CardProduct } from "@/lib/viewModels";
import { BROWSE_CATEGORIES } from "@/lib/categories";

const CATEGORIES = BROWSE_CATEGORIES;
const SORTS = [
  { id: "distance", label: "Nearest" },
  { id: "priceLow", label: "Cheapest" },
  { id: "priceHigh", label: "Most expensive" },
  { id: "newest", label: "Newest" },
];

export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { latitude, longitude } = useCoords();

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState(SORTS[0]);

  const { data, loading, error } = useAsync(
    () =>
      api.get<{ products: ApiProduct[] }>(
        `/products/search?latitude=${latitude}&longitude=${longitude}` +
          `&radius=400000&sort=${sort.id}&limit=50` +
          (query ? `&search=${encodeURIComponent(query)}` : "") +
          (category ? `&category=${category}` : "") +
          (inStockOnly ? "&inStockOnly=true" : ""),
      ),
    [query, category, inStockOnly, sort.id, latitude, longitude],
    { refetchOnFocus: true },
  );

  // Fold one-row-per-shop listings into one card per product BEFORE banding,
  // or the same phone lands in "Near you" and "Elsewhere" at once. A grouped
  // card carries its nearest shop, so it bands where the nearest offer is.
  const cards = groupByProduct(data?.products ?? []);

  // Same bands the server uses for delivery pricing.
  const near = cards.filter((c) => c.distanceMeters <= 8000);
  const city = cards.filter(
    (c) => c.distanceMeters > 8000 && c.distanceMeters <= 35000,
  );
  const far = cards.filter((c) => c.distanceMeters > 35000);
  const farCheapest = far.length ? Math.min(...far.map((c) => c.fromPrice)) : 0;

  const renderGroup = (title: string, list: CardProduct[]) =>
    list.length ? (
      <View style={{ gap: 10 }}>
        <Text style={styles.groupHead}>{title}</Text>
        <View style={styles.grid}>
          {list.map((card) => (
            <View key={card._id} style={{ width: "48%" }}>
              <ProductCard
                product={card}
                style={{ width: "100%" }}
                onPress={() => router.push(`/product/${card._id}`)}
                onAlert={() => router.push(`/product/${card._id}`)}
              />
            </View>
          ))}
        </View>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1 }}>
      <CreamHeader>
        <View style={styles.searchRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={15} color={colors.textTertiary} />
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => setQuery(input.trim())}
              returnKeyType="search"
              placeholder="Search products..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
            {input ? (
              <Pressable
                onPress={() => {
                  setInput("");
                  setQuery("");
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <CartButton />
        </View>
      </CreamHeader>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            <Text style={styles.countStrong}>{cards.length} products</Text>{" "}
            found
          </Text>
          <Pressable
            style={styles.sortButton}
            onPress={() => {
              const i = SORTS.findIndex((s) => s.id === sort.id);
              setSort(SORTS[(i + 1) % SORTS.length]);
            }}
          >
            <Text style={styles.sortText}>{sort.label}</Text>
            <Ionicons name="swap-vertical" size={12} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="In stock"
            active={inStockOnly}
            removable
            onPress={() => setInStockOnly((v) => !v)}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              active={category === c}
              removable
              onPress={() => setCategory((cur) => (cur === c ? null : c))}
            />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 24 }} />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title={error} action="Try again" />
        ) : cards.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Nothing matched that search"
            action="Try a shorter word, or clear your filters"
          />
        ) : (
          <View style={{ paddingHorizontal: spacing.gutter, gap: 20 }}>
            {renderGroup("Near you", near)}
            {renderGroup("Elsewhere in the city", city)}

            {far.length ? (
              <Pressable
                style={styles.nationwide}
                onPress={() => router.push(`/product/${far[0]._id}`)}
              >
                <Ionicons name="earth-outline" size={15} color={colors.ink} />
                <Text style={styles.nationwideText}>
                  {far.length} more {far.length === 1 ? "shop" : "shops"}{" "}
                  further away from {cedis(farCheapest)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.ink} />
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.gutter,
  },
  countText: { fontSize: 12, color: colors.textSecondary },
  countStrong: { fontWeight: "500", color: colors.textPrimary },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  sortText: { fontSize: 11, fontWeight: "500", color: colors.ink },
  chipRow: { paddingHorizontal: spacing.gutter, gap: 8 },
  groupHead: { fontSize: 13, fontWeight: "500", color: colors.textPrimary },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  nationwide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.cream,
    borderRadius: radius.card,
    padding: 13,
  },
  nationwideText: { flex: 1, fontSize: 12, fontWeight: "500", color: colors.ink },
});
