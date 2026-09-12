/**
 * Screen 7 - Checkout. Creates a real order, then pays it.
 *
 * Two things are genuinely happening here:
 *
 *  1. POST /api/orders reserves stock ATOMICALLY, item by item. If anything
 *     fails, the server rolls back every reservation it already made and
 *     answers 409 naming the item. That message is shown as-is.
 *
 *  2. POST /api/payments/mock-pay/:orderId marks it paid. That endpoint is a
 *     dev-only stand-in for Paystack and refuses to run in production.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/headers";
import { Button, Card, Divider, EmptyState, ImageWell } from "@/components/ui";
import { iconForCategory } from "@/components/cards";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { cedis, distance, phone as formatPhone } from "@/lib/format";
import { api, type ApiOrder } from "@/lib/api";
import { useCoords } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import { useCart, type CartLine } from "@/lib/cart";
import { SignInRequired } from "@/components/SignInRequired";

const STEPS = ["Cart", "Delivery", "Payment", "Done"];

export default function Checkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signedIn, addresses, paymentMethods, notify, notifyError } = useSession();
  const { lines, subtotal, clear } = useCart();
  const fallback = useCoords();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<ApiOrder | null>(null);

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const defaultMethod =
    paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];

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
        Math.round(g.lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) /
        100,
    }));
  }, [lines]);

  /** Create the order. This is where stock is actually reserved. */
  const placeOrder = async () => {
    if (lines.length === 0) return;

    const coords = defaultAddress
      ? {
          latitude: defaultAddress.location.coordinates[1],
          longitude: defaultAddress.location.coordinates[0],
        }
      : { latitude: fallback.latitude, longitude: fallback.longitude };

    setBusy(true);
    try {
      const order = await api.post<ApiOrder>("/orders", {
        deliveryAddress:
          defaultAddress?.address ?? "Address not set - please add one",
        latitude: coords.latitude,
        longitude: coords.longitude,
        items: lines.map((l) => ({
          product: l.productId,
          quantity: l.quantity,
        })),
      });

      setPlaced(order);
      setStep(2);
      notify({
        title: `Order ${order.orderNumber} created`,
        body: "Stock is now held for you. Complete payment to confirm it.",
        tone: "success",
      });
    } catch (error) {
      // A 409 here names the item that ran out - and the server has already
      // handed back every unit it reserved before hitting that item.
      notifyError(error, "Could not place your order");
    } finally {
      setBusy(false);
    }
  };

  /** Pay it, without Paystack. */
  const payOrder = async () => {
    if (!placed) return;

    setBusy(true);
    try {
      const result = await api.post<{ order: ApiOrder }>(
        `/payments/mock-pay/${placed._id}`,
        { channel: "mobile_money" },
      );

      clear();
      setStep(3);
      notify({
        title: "Payment recorded",
        body: `${placed.orderNumber} is paid. The shop can see it now.`,
        tone: "success",
      });
      router.replace(`/order/${result.order?._id ?? placed._id}`);
    } catch (error) {
      notifyError(error, "Could not record the payment");
    } finally {
      setBusy(false);
    }
  };

  // The cart is local, so a guest can fill one - but an order needs somewhere
  // to deliver to and someone to bill, which means an account.
  if (!signedIn) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Checkout" />
        <SignInRequired
          icon="bag-check-outline"
          title="Almost there"
          body="Your cart is saved. Create an account to add a delivery address and place the order - it takes a minute."
        />
      </View>
    );
  }

  if (lines.length === 0 && !placed) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Checkout" />
        <EmptyState
          icon="bag-outline"
          title="Nothing to check out"
          action="Add a product to your cart first"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Checkout" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.gutter, paddingBottom: 24, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress stepper */}
        <View style={styles.stepper}>
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={styles.stepRow}>
                  {i > 0 ? (
                    <View
                      style={[
                        styles.connector,
                        { backgroundColor: i <= step ? colors.ink : colors.border },
                      ]}
                    />
                  ) : (
                    <View style={styles.connectorSpacer} />
                  )}
                  <View
                    style={[
                      styles.stepCircle,
                      { backgroundColor: done || current ? colors.ink : colors.border },
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={12} color={colors.cream} />
                    ) : (
                      <Text
                        style={[
                          styles.stepNumber,
                          { color: current ? colors.cream : colors.textTertiary },
                        ]}
                      >
                        {i + 1}
                      </Text>
                    )}
                  </View>
                  {i < STEPS.length - 1 ? (
                    <View
                      style={[
                        styles.connector,
                        { backgroundColor: i < step ? colors.ink : colors.border },
                      ]}
                    />
                  ) : (
                    <View style={styles.connectorSpacer} />
                  )}
                </View>
                <Text style={styles.stepLabel}>{label}</Text>
              </View>
            );
          })}
        </View>

        {/* Items grouped by shop - one sub-order each on the server */}
        {(placed ? placed.subOrders : groups).map((group: any) => (
          <Card key={group.shopId ?? group.shop} style={{ gap: 10 }}>
            <View style={styles.groupHead}>
              <Ionicons name="storefront-outline" size={14} color={colors.ink} />
              <Text style={styles.groupName}>{group.shopName}</Text>
              {placed ? (
                <Text style={styles.groupMeta}>
                  {group.deliveryMethod === "pickup"
                    ? "Pickup"
                    : distance(group.distanceMeters ?? 0)}
                </Text>
              ) : null}
            </View>

            {(group.lines ?? group.items).map((line: any) => (
              <View key={line.productId ?? line.product} style={styles.line}>
                <ImageWell size={48} icon={iconForCategory(line.category ?? "Other")} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.lineMeta}>
                    {line.quantity} × {cedis(line.price)}
                  </Text>
                </View>
                <Text style={styles.linePrice}>
                  {cedis(line.lineTotal ?? line.price * line.quantity)}
                </Text>
              </View>
            ))}

            {placed ? (
              <>
                <Divider style={{ marginVertical: 2 }} />
                <View style={styles.groupFoot}>
                  <Text style={styles.groupFootLabel}>
                    {group.deliveryMethod === "pickup"
                      ? "Pickup from shop"
                      : group.deliveryEstimate ?? "Delivery"}
                  </Text>
                  <Text style={styles.groupFootValue}>
                    {group.deliveryFee === 0 ? "Free" : cedis(group.deliveryFee)}
                  </Text>
                </View>
              </>
            ) : null}
          </Card>
        ))}

        {/* Delivery address */}
        <Card style={{ gap: 10 }}>
          <Text style={styles.cardTitle}>Delivery address</Text>
          {defaultAddress ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={15} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressLabel}>{defaultAddress.label}</Text>
                <Text style={styles.addressText}>{defaultAddress.address}</Text>
              </View>
              <Pressable onPress={() => router.push("/profile/addresses")}>
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <Button
              label="Add a delivery address"
              variant="outline"
              small
              full
              icon="add"
              onPress={() => router.push("/profile/addresses")}
            />
          )}
        </Card>

        {/* Payment */}
        <Card style={{ gap: 10 }}>
          <Text style={styles.cardTitle}>Payment</Text>
          {defaultMethod ? (
            <View style={styles.addressRow}>
              <View style={styles.payWell}>
                <Ionicons name="phone-portrait-outline" size={15} color={colors.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressLabel}>
                  {defaultMethod.provider} Mobile Money
                </Text>
                <Text style={styles.addressText}>
                  {formatPhone(defaultMethod.phone)}
                </Text>
              </View>
              <Pressable onPress={() => router.push("/profile/payment-methods")}>
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <Button
              label="Add a mobile money number"
              variant="outline"
              small
              full
              icon="add"
              onPress={() => router.push("/profile/payment-methods")}
            />
          )}

          <View style={styles.mockNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.ink} />
            <Text style={styles.mockText}>
              You will confirm the payment on your phone. Your order is only
              sent to the shop once it goes through.
            </Text>
          </View>
        </Card>

        {/* Totals */}
        <Card style={{ gap: 9 }}>
          <Text style={styles.cardTitle}>Price breakdown</Text>
          <Row label="Subtotal" value={cedis(placed?.itemsTotal ?? subtotal)} />
          <Row
            label="Delivery"
            value={
              placed
                ? placed.deliveryTotal === 0
                  ? "Free"
                  : cedis(placed.deliveryTotal)
                : "Calculated when you place the order"
            }
          />
          <Row label="Platform fee" value={cedis(placed?.platformFee ?? 0)} />
          <Divider style={{ marginVertical: 2 }} />
          <Row
            label="Total"
            value={cedis(placed?.grandTotal ?? subtotal)}
            strong
          />
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!placed ? (
          <Button
            label="Place order"
            full
            loading={busy}
            icon="checkmark-circle-outline"
            onPress={placeOrder}
          />
        ) : (
          <Button
            label={`Pay ${cedis(placed.grandTotal)}`}
            full
            loading={busy}
            icon="lock-closed-outline"
            onPress={payOrder}
          />
        )}
        <View style={styles.secured}>
          <Ionicons name="shield-checkmark-outline" size={11} color={colors.textMuted} />
          <Text style={styles.securedText}>
            {placed ? "Secured payment" : "Your items are held once you place the order"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const Row = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <View style={styles.breakdownRow}>
    <Text style={[styles.breakdownLabel, strong && styles.breakdownStrong]}>
      {label}
    </Text>
    <Text style={[styles.breakdownValue, strong && styles.breakdownStrong]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", marginBottom: 4 },
  stepItem: { flex: 1, alignItems: "center", gap: 6 },
  stepRow: { flexDirection: "row", alignItems: "center", width: "100%" },
  connector: { flex: 1, height: 1 },
  connectorSpacer: { flex: 1 },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: { fontSize: 11, fontWeight: "500" },
  stepLabel: { fontSize: 10, color: colors.textTertiary },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  groupName: { flex: 1, ...type.cardTitle, color: colors.textPrimary },
  groupMeta: { fontSize: 10, color: colors.textTertiary },
  line: { flexDirection: "row", gap: 11, alignItems: "center" },
  lineName: { ...type.cardTitle, color: colors.textPrimary },
  lineMeta: { fontSize: 10, color: colors.textTertiary },
  linePrice: { ...type.priceCard, color: colors.textPrimary },
  groupFoot: { flexDirection: "row", justifyContent: "space-between" },
  groupFootLabel: { fontSize: 11, color: colors.textSecondary },
  groupFootValue: { fontSize: 11, fontWeight: "500", color: colors.textPrimary },
  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  addressLabel: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  addressText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  changeLink: { fontSize: 11, fontWeight: "500", color: colors.ink },
  payWell: {
    width: 32,
    height: 32,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  mockNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: colors.cream,
    borderRadius: radius.button,
    padding: 11,
  },
  mockText: { flex: 1, fontSize: 10, color: colors.textSecondary, lineHeight: 15 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 12, color: colors.textSecondary },
  breakdownValue: { fontSize: 12, color: colors.textPrimary },
  breakdownStrong: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  footer: {
    backgroundColor: colors.white,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
    gap: 8,
  },
  secured: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  securedText: { fontSize: 10, color: colors.textMuted },
});
