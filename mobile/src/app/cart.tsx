/**
 * Cart.
 *
 * Grouped by shop, because that is how the order will actually be created -
 * one sub-order per shop, each with its own delivery. Showing a flat list
 * would misrepresent what the customer is buying.
 *
 * Nothing here is reserved. Stock is taken at checkout, atomically, so this
 * screen warns when a line is close to the stock it last saw rather than
 * pretending anything is held.
 */
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/headers";
import { Button, Card, Divider, EmptyState, ImageWell, StatusPill } from "@/components/ui";
import { iconForCategory } from "@/components/cards";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { cedis } from "@/lib/format";
import { useCart, type CartLine } from "@/lib/cart";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lines, subtotal, count, setQuantity, remove, clear } = useCart();

  const groups = useMemo(() => {
    const map = new Map<string, { shopName: string; lines: CartLine[] }>();
    for (const line of lines) {
      if (!map.has(line.shopId)) {
        map.set(line.shopId, { shopName: line.shopName, lines: [] });
      }
      map.get(line.shopId)!.lines.push(line);
    }
    return [...map.entries()].map(([shopId, g]) => ({
      shopId,
      shopName: g.shopName,
      lines: g.lines,
      subtotal:
        Math.round(
          g.lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100,
        ) / 100,
    }));
  }, [lines]);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Your cart"
        trailingText={count ? `${count} ${count === 1 ? "item" : "items"}` : undefined}
        actions={
          lines.length
            ? [{ icon: "trash-outline", onPress: clear }]
            : []
        }
      />

      {lines.length === 0 ? (
        <EmptyState
          icon="bag-outline"
          title="Your cart is empty"
          action="Find a product and tap Add to cart"
        />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              padding: spacing.gutter,
              paddingBottom: 24,
              gap: 10,
            }}
            showsVerticalScrollIndicator={false}
          >
            {groups.length > 1 ? (
              <View style={styles.splitNote}>
                <Ionicons name="git-branch-outline" size={14} color={colors.ink} />
                <Text style={styles.splitText}>
                  This cart covers {groups.length} shops. Each one delivers
                  separately, so you will see a delivery cost per shop.
                </Text>
              </View>
            ) : null}

            {groups.map((group) => (
              <Card key={group.shopId} style={{ gap: 11 }}>
                <View style={styles.groupHead}>
                  <Ionicons name="storefront-outline" size={14} color={colors.ink} />
                  <Text style={styles.groupName}>{group.shopName}</Text>
                  <Text style={styles.groupTotal}>{cedis(group.subtotal)}</Text>
                </View>

                <Divider style={{ marginVertical: 0 }} />

                {group.lines.map((line) => {
                  const atMax = line.quantity >= line.stockCount;
                  return (
                    <View key={line.productId} style={styles.line}>
                      <ImageWell
                        size={52}
                        icon={iconForCategory(line.category)}
                      />

                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.lineName} numberOfLines={2}>
                          {line.name}
                        </Text>
                        <Text style={styles.linePrice}>
                          {cedis(line.price)} each
                        </Text>

                        <View style={styles.qtyRow}>
                          <Pressable
                            onPress={() =>
                              setQuantity(line.productId, line.quantity - 1)
                            }
                            hitSlop={6}
                            style={styles.qtyButton}
                          >
                            <Ionicons name="remove" size={13} color={colors.ink} />
                          </Pressable>
                          <Text style={styles.qtyValue}>{line.quantity}</Text>
                          <Pressable
                            onPress={() =>
                              setQuantity(line.productId, line.quantity + 1)
                            }
                            hitSlop={6}
                            disabled={atMax}
                            style={[styles.qtyButton, atMax && { opacity: 0.35 }]}
                          >
                            <Ionicons name="add" size={13} color={colors.ink} />
                          </Pressable>

                          {atMax ? (
                            <StatusPill
                              label={`Only ${line.stockCount} left`}
                              tone="warning"
                            />
                          ) : null}
                        </View>
                      </View>

                      <View style={{ alignItems: "flex-end", gap: 10 }}>
                        <Text style={styles.lineTotal}>
                          {cedis(line.price * line.quantity)}
                        </Text>
                        <Pressable
                          onPress={() => remove(line.productId)}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="close"
                            size={15}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </Card>
            ))}

            <Text style={styles.footnote}>
              Nothing is reserved until you check out. If an item sells out
              before then, we will tell you which one.
            </Text>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Subtotal</Text>
              <Text style={styles.subtotalValue}>{cedis(subtotal)}</Text>
            </View>
            <Text style={styles.deliveryNote}>
              Delivery is calculated per shop at checkout.
            </Text>
            <Button
              label="Continue to checkout"
              full
              icon="arrow-forward"
              onPress={() => router.push("/checkout")}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splitNote: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    backgroundColor: colors.cream,
    borderRadius: radius.card,
    padding: 12,
  },
  splitText: { flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  groupName: { flex: 1, ...type.cardTitle, color: colors.textPrimary },
  groupTotal: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  line: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  lineName: { ...type.cardTitle, color: colors.textPrimary },
  linePrice: { fontSize: 10, color: colors.textTertiary },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  qtyButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: { fontSize: 12, fontWeight: "500", color: colors.textPrimary, minWidth: 14, textAlign: "center" },
  lineTotal: { ...type.priceCard, color: colors.textPrimary },
  footnote: {
    fontSize: 10,
    color: colors.textTertiary,
    lineHeight: 15,
    paddingHorizontal: 2,
  },
  footer: {
    backgroundColor: colors.white,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
    gap: 6,
  },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between" },
  subtotalLabel: { fontSize: 13, color: colors.textSecondary },
  subtotalValue: { fontSize: 16, fontWeight: "500", color: colors.textPrimary },
  deliveryNote: { fontSize: 10, color: colors.textTertiary, marginBottom: 6 },
});
