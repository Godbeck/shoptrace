/**
 * Screen 16 - Shop settings. Real shop from GET /api/shops/my-shop, saved with
 * PATCH /api/shops/my-shop.
 *
 * The delivery block is the one to read carefully: a merchant picks from named
 * ranges and never types a distance or a fee. That is enforced on the server
 * too - the update allowlist has no fee field to write to.
 *
 * Renaming the shop queues the shop-name sync job, because products keep a
 * denormalised copy of the name.
 */
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { InkHeader } from "@/components/headers";
import { Button, Card, Divider, Field, StatusPill } from "@/components/ui";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useShop } from "@/lib/shop";
import { CATEGORIES } from "@/lib/categories";



const RANGES = [
  { id: "none", label: "Pickup only", sub: "Customers collect in store" },
  { id: "area", label: "My area", sub: "Around 8km" },
  { id: "city", label: "All of my city", sub: "Around 35km" },
  { id: "nationwide", label: "Nationwide", sub: "Anywhere in Ghana" },
] as const;

export default function ShopSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setSurface, signOut, notify, notifyError } = useSession();
  const { shop, reload } = useShop();

  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [shopPhone, setShopPhone] = useState("");
  const [address, setAddress] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [range, setRange] = useState<string>("city");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!shop) return;
    setName(shop.name);
    setCategories(shop.categories ?? []);
    setShopPhone(shop.phone);
    setAddress(shop.address);
    setOpeningHours(shop.openingHours);
    setRange(shop.deliveryRange);
  }, [shop]);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch("/shops/my-shop", {
        name: name.trim(),
        categories,
        phone: shopPhone.trim(),
        address: address.trim(),
        openingHours: openingHours.trim(),
        deliveryRange: range,
      });
      await reload();
      notify({ title: "Shop updated", tone: "success" });
    } catch (error) {
      notifyError(error, "Could not save your shop");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <InkHeader>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.cream} />
          </Pressable>
          <Text style={styles.title}>Shop settings</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.logoWell}>
            <Ionicons name="storefront" size={22} color={colors.ink} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.shopName} numberOfLines={1}>
              {shop?.name}
            </Text>
            <Text style={styles.shopMeta} numberOfLines={1}>
              {shop?.address}
            </Text>
          </View>
          {shop?.status === "verified" ? (
            <View style={styles.verifiedChip}>
              <Ionicons name="checkmark-circle" size={11} color={colors.cream} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : null}
        </View>
      </InkHeader>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Section title="Shop info">
          <Field label="Shop name" value={name} onChangeText={setName} />

          <View>
            <Text style={styles.fieldLabel}>What do you sell?</Text>
            <View style={styles.wrapRow}>
              {CATEGORIES.map((c) => {
                const selected = categories.includes(c);
                return (
                  <Pressable
                    key={c}
                    onPress={() =>
                      setCategories((current) =>
                        current.includes(c)
                          ? current.filter((x) => x !== c)
                          : [...current, c],
                      )
                    }
                    style={[
                      styles.pill,
                      selected && { backgroundColor: colors.ink, borderColor: colors.ink },
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={12} color={colors.cream} />
                    ) : null}
                    <Text
                      style={[
                        styles.pillText,
                        { color: selected ? colors.cream : colors.textPrimary },
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field
            label="Shop phone"
            prefix="+233"
            value={shopPhone}
            onChangeText={setShopPhone}
            keyboardType="phone-pad"
          />
          <Field label="Address" value={address} onChangeText={setAddress} />
          <Field
            label="Opening hours"
            value={openingHours}
            onChangeText={setOpeningHours}
            placeholder="Mon - Sat, 8:00am - 7:00pm"
          />
          <Text style={styles.hint}>
            Renaming the shop updates the copy your products carry, so search
            keeps showing the right name.
          </Text>
        </Section>

        <Card style={{ gap: 10 }}>
          <Text style={styles.cardTitle}>How far will you deliver?</Text>
          {RANGES.map((r) => {
            const selected = range === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setRange(r.id)}
                style={[
                  styles.rangeOption,
                  selected && {
                    borderColor: colors.ink,
                    borderWidth: borderWidth.selected,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rangeName}>{r.label}</Text>
                  <Text style={styles.rangeSub}>{r.sub}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    selected && { borderColor: colors.ink, borderWidth: 5 },
                  ]}
                />
              </Pressable>
            );
          })}
          <Text style={styles.hint}>
            You pick a range, never a fee. ShopTrace prices delivery from real
            distance, so a customer outside your range simply sees pickup.
          </Text>
        </Card>

        <Card style={{ gap: 9 }}>
          <Text style={styles.cardTitle}>Plan</Text>
          <View style={styles.planRow}>
            <StatusPill
              label={`${shop ? (shop as any).subscriptionTier ?? "free" : "free"} plan`}
              tone="info"
            />
            {shop?.isFeatured ? <StatusPill label="Featured" tone="success" /> : null}
          </View>
          <Text style={styles.hint}>
            Your plan sets how many products you can list. Get in touch to
            upgrade.
          </Text>
        </Card>

        <Button label="Save changes" full loading={busy} onPress={save} />

        <Button
          label="Switch to customer view"
          variant="outline"
          full
          icon="swap-horizontal-outline"
          onPress={() => {
            setSurface("customer");
            router.replace("/customer");
          }}
        />

        <Button
          label="Sign out"
          variant="danger"
          full
          icon="log-out-outline"
          onPress={async () => {
            await signOut();
            // Back to browsing, not to a login wall.
            router.replace("/customer");
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Card padded={false} style={{ overflow: "hidden" }}>
    <View style={styles.sectionStrip}>
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
    <View style={{ padding: spacing.card, gap: 12 }}>{children}</View>
  </Card>
);

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { ...type.pageTitle, color: colors.cream },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  logoWell: {
    width: 52,
    height: 52,
    borderRadius: radius.panel,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: { fontSize: 15, fontWeight: "500", color: colors.cream },
  shopMeta: { fontSize: 11, color: "rgba(253,240,213,0.60)" },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verifiedText: { fontSize: 10, fontWeight: "500", color: colors.cream },
  sectionStrip: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.card,
    paddingVertical: 8,
  },
  sectionLabel: { fontSize: 11, fontWeight: "500", color: colors.ink },
  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: 7,
  },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  pillText: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  rangeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    padding: 12,
  },
  rangeName: { fontSize: 12.5, fontWeight: "500", color: colors.textPrimary },
  rangeSub: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  radio: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  planRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  hint: { fontSize: 10, color: colors.textTertiary, lineHeight: 15 },
});
