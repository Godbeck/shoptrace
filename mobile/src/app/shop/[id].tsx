/**
 * Screen 6 - Shop profile. Real shop from GET /api/shops/:id, with its
 * products pulled from the geo search filtered to this shop.
 *
 * Call and WhatsApp sit beside Order as equals. That is deliberate for the
 * Ghanaian market: plenty of purchases are confirmed by phone even when they
 * were discovered online.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader, Tabs } from "@/components/headers";
import { iconForCategory, PriceFrom } from "@/components/cards";
import {
  Button,
  Card,
  Divider,
  EmptyState,
  ImageWell,
  InkPill,
  StatusPill,
  VerifiedBadge,
} from "@/components/ui";
import { borderWidth, colors, radius, spacing, status, type } from "@/theme";
import { distance } from "@/lib/format";
import { api, type ApiProduct, type ApiShop } from "@/lib/api";
import { useAsync, useCoords } from "@/lib/useApi";
import { metresBetween } from "@/lib/adapt";
import { useSession } from "@/lib/session";

export default function ShopProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notify } = useSession();
  const coords = useCoords();
  const [tab, setTab] = useState("Products");

  const shopQuery = useAsync(
    () => api.get<{ shop: ApiShop }>(`/shops/${id}`),
    [id],
  );

  // There is no "products for shop X" endpoint, so the geo search is used and
  // filtered. Worth replacing with a real endpoint if this list grows.
  const productsQuery = useAsync(
    () =>
      api.get<{ products: ApiProduct[] }>(
        `/products/search?latitude=${coords.latitude}&longitude=${coords.longitude}&radius=400000&limit=50`,
      ),
    [coords.latitude, coords.longitude],
  );

  const shop = shopQuery.data?.shop;
  const products = (productsQuery.data?.products ?? []).filter((p) => {
    const shopId = typeof p.shop === "string" ? p.shop : p.shop?._id;
    return shopId === id;
  });

  if (shopQuery.loading) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Shop" />
        <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (shopQuery.error || !shop) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Shop" />
        <EmptyState
          icon="cloud-offline-outline"
          title={shopQuery.error ?? "Shop not found"}
          action="Go back and try another shop"
        />
      </View>
    );
  }

  const [longitude, latitude] = shop.location?.coordinates ?? [0, 0];
  const away = metresBetween(coords, { latitude, longitude });

  const call = () => Linking.openURL(`tel:${shop.phone}`).catch(() => {});
  const whatsapp = () =>
    Linking.openURL(`whatsapp://send?phone=233${shop.phone.slice(1)}`).catch(() =>
      notify({ title: "WhatsApp is not installed on this device" }),
    );

  const rangeLabel =
    shop.deliveryRange === "none"
      ? "Pickup only"
      : shop.deliveryRange === "area"
        ? "Delivers around this area"
        : shop.deliveryRange === "city"
          ? "Delivers across the city"
          : "Delivers nationwide";

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader actions={[]} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <ImageWell
            size={60}
            icon={iconForCategory(shop.categories?.[0] ?? "Other")}
          />
          <Text style={styles.shopName}>{shop.name}</Text>
          <Text style={styles.shopMeta}>{shop.address}</Text>
          {/* A shop can sell across several categories, so they get their own
              row of chips rather than being squeezed into one line. */}
          <View style={styles.categoryRow}>
            {(shop.categories ?? []).map((c) => (
              <View key={c} style={styles.categoryChip}>
                <Text style={styles.categoryText}>{c}</Text>
              </View>
            ))}
          </View>
          <View style={styles.badgeRow}>
            {shop.status === "verified" ? <VerifiedBadge /> : null}
            {shop.isFeatured ? <InkPill label="Featured" /> : null}
          </View>
        </View>

        <View style={{ padding: spacing.gutter, gap: 10 }}>
          <View style={styles.statRow}>
            <Stat label="Products" value={String(products.length)} />
            <Stat
              label="Rating"
              value={shop.averageRating ? shop.averageRating.toFixed(1) : "—"}
            />
            <Stat label="Distance" value={distance(away)} />
            <Stat label="Reviews" value={String(shop.reviewCount)} />
          </View>

          <View style={styles.actionRow}>
            <Button
              label="Call"
              variant="outline"
              icon="call-outline"
              style={{ flex: 1 }}
              onPress={call}
            />
            <Button
              label="WhatsApp"
              variant="outline"
              icon="logo-whatsapp"
              style={{ flex: 1 }}
              onPress={whatsapp}
            />
          </View>
        </View>

        <Tabs items={["Products", "Info"]} value={tab} onChange={setTab} />

        <View style={{ padding: spacing.gutter, gap: 10 }}>
          {tab === "Products" ? (
            productsQuery.loading ? (
              <ActivityIndicator color={colors.ink} style={{ marginVertical: 20 }} />
            ) : products.length === 0 ? (
              <EmptyState
                icon="cube-outline"
                title="Nothing listed yet"
                action="This shop has not added any products"
              />
            ) : (
              <View style={styles.grid}>
                {products.map((p) => (
                  <Pressable
                    key={p._id}
                    onPress={() => router.push(`/product/${p._id}`)}
                    style={styles.gridCard}
                  >
                    <ImageWell
                      style={{ height: 88, width: "100%" }}
                      radius={0}
                      icon={iconForCategory(p.category)}
                    />
                    <View style={{ padding: 10, gap: 5 }}>
                      <Text style={styles.gridName} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <PriceFrom amount={p.price} />
                      <StatusPill
                        label={p.inStock ? "In stock" : "Out of stock"}
                        tone={p.inStock ? "success" : "danger"}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            )
          ) : (
            <Card style={{ gap: 12 }}>
              <InfoRow
                icon="time-outline"
                label="Opening hours"
                value={shop.openingHours}
              />
              <Divider />
              <InfoRow icon="call-outline" label="Phone" value={shop.phone} />
              <Divider />
              <InfoRow icon="location-outline" label="Address" value={shop.address} />
              <Divider />
              <InfoRow icon="bicycle-outline" label="Delivery" value={rangeLabel} />
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) => (
  <View style={styles.infoRow}>
    <View style={styles.infoWell}>
      <Ionicons name={icon} size={15} color={colors.ink} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.cream,
    alignItems: "center",
    paddingBottom: 22,
    paddingHorizontal: spacing.screen,
    gap: 6,
    position: "relative",
  },
  shopName: { fontSize: 18, fontWeight: "500", color: colors.ink, marginTop: 8 },
  shopMeta: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 10, fontWeight: "500", color: colors.textPrimary },
  statRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
    gap: 3,
  },
  statValue: { fontSize: 15, fontWeight: "500", color: colors.textPrimary },
  statLabel: { fontSize: 9, color: colors.textTertiary },
  actionRow: { flexDirection: "row", gap: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  gridCard: {
    width: "48.5%",
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    overflow: "hidden",
  },
  gridName: { ...type.cardTitle, color: colors.textPrimary },
  infoRow: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  infoWell: {
    width: 32,
    height: 32,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 10, color: colors.textTertiary },
  infoValue: { fontSize: 12, color: colors.textPrimary },
});
