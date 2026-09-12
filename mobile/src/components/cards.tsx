/**
 * Product and shop cards - design.md section 6.
 *
 * The "from GH₵ 890" treatment is the most important detail in this file.
 * "from" in text-tertiary at 10px tells the customer that several prices
 * exist and comparison is available - which is the entire point of ShopTrace.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { borderWidth, card, colors, radius, spacing, type } from "@/theme";
import { cedis, distance, dropPercent } from "@/lib/format";
import { ImageWell, InkPill, StatusPill, VerifiedBadge } from "./ui";
import type { CardProduct, CardShop } from "@/lib/viewModels";

/* ---------------------------------------------------------- PriceFrom */

/** `from GH₵ 890` - the signal that a comparison is available. */
export const PriceFrom = ({
  amount,
  size = "card",
}: {
  amount: number;
  size?: "card" | "hero";
}) => (
  <View style={styles.priceRow}>
    <Text style={styles.fromLabel}>from</Text>
    <Text
      style={size === "hero" ? styles.priceHero : styles.priceCard}
      numberOfLines={1}
    >
      {cedis(amount)}
    </Text>
  </View>
);

/**
 * A price drop: new price in ink, old struck through in muted, then a
 * percentage pill. Never red or green - the drop is information, not an alarm.
 */
export const PriceDrop = ({
  from,
  to,
}: {
  from: number;
  to: number;
}) => (
  <View style={styles.dropRow}>
    <Text style={styles.priceCard}>{cedis(to)}</Text>
    <Text style={styles.struck}>{cedis(from)}</Text>
    <InkPill label={dropPercent(from, to)} />
  </View>
);

/* -------------------------------------------------------- ProductCard */

export const ProductCard = ({
  product,
  width = 168,
  onPress,
  onAlert,
  showDrop = false,
  style,
}: {
  product: CardProduct;
  width?: number;
  onPress?: () => void;
  onAlert?: () => void;
  showDrop?: boolean;
  style?: ViewStyle;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      card,
      styles.productCard,
      { width },
      pressed && { opacity: 0.9 },
      style,
    ]}
  >
    <View style={styles.productImage}>
      <ImageWell
        style={styles.fill}
        radius={0}
        icon={iconForCategory(product.category)}
      />
      {product.isFeatured ? (
        <View style={styles.featuredSlot}>
          <InkPill label="Featured" />
        </View>
      ) : null}
      <Pressable onPress={onAlert} hitSlop={6} style={styles.bellSlot}>
        <Ionicons name="notifications-outline" size={13} color={colors.ink} />
      </Pressable>
    </View>

    <View style={styles.productBody}>
      <Text style={styles.productName} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.shopCount}>
        {product.shopCount} {product.shopCount === 1 ? "shop" : "shops"} nearby
      </Text>
      {showDrop && product.previousPrice ? (
        <PriceDrop from={product.previousPrice} to={product.fromPrice} />
      ) : (
        <PriceFrom amount={product.fromPrice} />
      )}
    </View>
  </Pressable>
);

/* ----------------------------------------------------------- ShopCard */

export const ShopCard = ({
  shop,
  width = 210,
  onPress,
}: {
  shop: CardShop;
  width?: number;
  onPress?: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      card,
      { width, padding: spacing.card, gap: 9 },
      pressed && { opacity: 0.9 },
    ]}
  >
    <View style={styles.shopTop}>
      <ImageWell size={40} icon={iconForCategory(shop.categories?.[0] ?? "Other")} />
      <View style={{ flex: 1 }}>
        <Text style={styles.productName} numberOfLines={1}>
          {shop.name}
        </Text>
        <Text style={styles.shopCount}>
          {shop.category} · {distance(shop.distanceMeters)}
        </Text>
      </View>
    </View>
    <View style={styles.shopBottom}>
      {shop.status === "verified" ? <VerifiedBadge /> : null}
      {shop.isFeatured ? <InkPill label="Featured" /> : null}
    </View>
  </Pressable>
);

/* ------------------------------------------------------ CompactProduct */

/** A wide row: image well left, details right. Used in lists, not grids. */
export const ProductRow = ({
  name,
  meta,
  price,
  right,
  icon = "cube-outline",
  badge,
  onPress,
}: {
  name: string;
  meta: string;
  price?: number;
  right?: React.ReactNode;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  badge?: { label: string; tone: "success" | "warning" | "danger" | "info" };
  onPress?: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
  >
    <ImageWell size={52} icon={icon} />
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={styles.productName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.shopCount} numberOfLines={1}>
        {meta}
      </Text>
      <View style={styles.rowPriceLine}>
        {price !== undefined ? (
          <Text style={styles.priceCard}>{cedis(price)}</Text>
        ) : null}
        {badge ? <StatusPill label={badge.label} tone={badge.tone} /> : null}
      </View>
    </View>
    {right}
  </Pressable>
);

/** Category icons - stands in until real product images are wired up. */
export function iconForCategory(
  category: string,
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (category) {
    case "Electronics":
      return "phone-portrait-outline";
    case "Fashion":
      return "shirt-outline";
    case "Home":
      return "bed-outline";
    case "Hardware":
      return "hammer-outline";
    default:
      return "cube-outline";
  }
}

const styles = StyleSheet.create({
  productCard: { overflow: "hidden" },
  productImage: {
    height: 110,
    backgroundColor: colors.creamTint,
    position: "relative",
  },
  fill: { width: "100%", height: "100%" },
  featuredSlot: { position: "absolute", top: 8, left: 8 },
  bellSlot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  productBody: { padding: 11, gap: 4 },
  productName: { ...type.cardTitle, color: colors.textPrimary },
  shopCount: { ...type.metaSmall, color: colors.textTertiary },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  fromLabel: { fontSize: 10, color: colors.textTertiary },
  priceCard: { ...type.priceCard, color: colors.textPrimary },
  priceHero: { ...type.priceHero, color: colors.textPrimary },
  dropRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  struck: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  shopTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  shopBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    paddingVertical: 11,
  },
  rowPriceLine: { flexDirection: "row", alignItems: "center", gap: 8 },
});
