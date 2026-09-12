/**
 * Screen 3 - Customer home. Real products from GET /api/products/search.
 *
 * Cream header (customer surface), cream-deep body.
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CreamHeader, LogoMark } from "@/components/headers";
import { CartButton } from "@/components/CartButton";
import { NotificationBell } from "@/components/NotificationBell";
import { ProductCard, ShopCard } from "@/components/cards";
import { Button, Chip, EmptyState, SectionHead } from "@/components/ui";
import { borderWidth, colors, radius, spacing } from "@/theme";
import { api, type ApiProduct, type ApiShop } from "@/lib/api";
import { useAsync, useCoords } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import { groupByProduct, toCardShop } from "@/lib/adapt";
import { BROWSE_CATEGORIES } from "@/lib/categories";

const CATEGORIES = ["All", ...BROWSE_CATEGORIES];

export default function CustomerHome() {
  const router = useRouter();
  const { user, signedIn, notify } = useSession();
  const { latitude, longitude, address } = useCoords();
  const [category, setCategory] = useState("All");

  const query = `latitude=${latitude}&longitude=${longitude}&radius=300000`;

  const products = useAsync(
    () =>
      api.get<{ products: ApiProduct[] }>(
        `/products/search?${query}${category === "All" ? "" : `&category=${category}`}&limit=20`,
      ),
    [category, latitude, longitude],
    { refetchOnFocus: true },
  );

  const shops = useAsync(
    () => api.get<{ shops: ApiShop[] }>(`/shops/nearby?${query}`),
    [latitude, longitude],
  );

  const list = products.data?.products ?? [];

  return (
    <View style={{ flex: 1 }}>
      <CreamHeader>
        <View style={styles.topRow}>
          <LogoMark surface="cream" />
          <Text style={styles.wordmark}>ShopTrace</Text>
          <View style={{ flex: 1 }} />
          <NotificationBell />
          <CartButton />
          <Pressable hitSlop={8} onPress={() => router.push("/customer/profile")}>
            <Ionicons name="person-circle-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <Pressable
          style={styles.locationRow}
          onPress={() => router.push("/profile/addresses")}
        >
          <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
          <Text style={styles.locationLabel}>Delivering to </Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {address?.address ?? (signedIn ? "Set your address" : "Accra")}
          </Text>
          <Ionicons name="chevron-down" size={13} color={colors.ink} />
        </Pressable>

        <Pressable
          style={styles.searchBox}
          onPress={() => router.push("/customer/search")}
        >
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            placeholder="Search products, shops..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            editable={false}
            pointerEvents="none"
          />
          <View style={styles.filterButton}>
            <Ionicons name="options-outline" size={13} color={colors.cream} />
            <Text style={styles.filterText}>Filter</Text>
          </View>
        </Pressable>
      </CreamHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 14, gap: 22 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              active={c === category}
              onPress={() => setCategory(c)}
            />
          ))}
        </ScrollView>

        {user?.role !== "merchant" ? (
          <View style={styles.recruitWrap}>
            <View style={styles.recruit}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.recruitTitle}>Are you a shop owner?</Text>
                <Text style={styles.recruitSub}>
                  List your products free and reach customers nearby.
                </Text>
              </View>
              <Button
                label="List free"
                variant="cream"
                small
                onPress={() =>
                  notify({
                    title: "Open a merchant account",
                    body: "Sign out, then choose Merchant when you sign up.",
                  })
                }
              />
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <SectionHead
            title="Products near you"
            actionLabel="See all"
            onAction={() => router.push("/customer/search")}
          />

          {products.loading ? (
            <ActivityIndicator color={colors.ink} style={{ marginVertical: 20 }} />
          ) : products.error ? (
            <EmptyState
              icon="cloud-offline-outline"
              title={products.error}
              action="Pull the screen or check the server is running"
            />
          ) : list.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="Nothing listed near you yet"
              action="Try widening your area, or check back soon"
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollRow}
            >
              {groupByProduct(list).map((card) => (
                <ProductCard
                  key={card._id}
                  product={card}
                  onPress={() => router.push(`/product/${card._id}`)}
                  onAlert={() => router.push(`/product/${card._id}`)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <SectionHead title="Shops near you" />
          {shops.loading ? (
            <ActivityIndicator color={colors.ink} style={{ marginVertical: 16 }} />
          ) : (shops.data?.shops ?? []).length === 0 ? (
            <EmptyState
              icon="storefront-outline"
              title="No shops near you yet"
              action="Try a different delivery address"
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollRow}
            >
              {(shops.data?.shops ?? []).map((s) => (
                <ShopCard
                  key={s._id}
                  shop={toCardShop(s, { latitude, longitude })}
                  onPress={() => router.push(`/shop/${s._id}`)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  wordmark: { fontSize: 15, fontWeight: "500", color: colors.ink },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationLabel: { fontSize: 12, color: colors.textTertiary },
  locationValue: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "500",
    color: colors.ink,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingLeft: 12,
    paddingRight: 5,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.ink,
    borderRadius: radius.button,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterText: { fontSize: 11, fontWeight: "500", color: colors.cream },
  chipRow: { paddingHorizontal: spacing.gutter, gap: 8 },
  scrollRow: { paddingHorizontal: spacing.gutter, gap: spacing.row },
  recruitWrap: { paddingHorizontal: spacing.gutter },
  recruit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.ink,
    borderRadius: radius.panel,
    padding: spacing.card,
  },
  recruitTitle: { fontSize: 14, fontWeight: "500", color: colors.cream },
  recruitSub: { fontSize: 11, color: "rgba(253,240,213,0.60)", lineHeight: 15 },
});
