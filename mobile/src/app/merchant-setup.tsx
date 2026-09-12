/**
 * Merchant onboarding. Lives outside app/merchant/ so it renders with NO tab
 * bar - an unverified merchant has nothing to navigate to yet.
 *
 * Two states:
 *   none                  -> the shop registration form
 *   pending / suspended   -> a plain waiting screen
 */
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { InkHeader } from "@/components/headers";
import { Button, Card, Field } from "@/components/ui";
import { borderWidth, colors, radius, spacing, status, type } from "@/theme";
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

/** Real Accra coordinates, so delivery prices sensibly from the start. */
const PRESETS = [
  { label: "Osu", address: "Oxford Street, Osu, Accra", latitude: 5.556, longitude: -0.1969 },
  { label: "East Legon", address: "Lagos Avenue, East Legon, Accra", latitude: 5.6363, longitude: -0.1608 },
  { label: "Madina", address: "Madina Market, Accra", latitude: 5.6836, longitude: -0.1667 },
  { label: "Tema", address: "Community 1, Tema", latitude: 5.6698, longitude: -0.0166 },
  { label: "Kumasi", address: "Adum, Kumasi", latitude: 6.6885, longitude: -1.6244 },
];

export default function MerchantSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, notify, notifyError } = useSession();
  const { shop, state, reload } = useShop();

  const [name, setName] = useState("");
  // A shop can sell across several categories - a hardware shop that also
  // stocks fans should appear in both searches.
  const [categories, setCategories] = useState<string[]>(["Electronics"]);
  const [description, setDescription] = useState("");
  const [shopPhone, setShopPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("city");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const usePreset = (p: (typeof PRESETS)[number]) => {
    setAddress(p.address);
    setLatitude(String(p.latitude));
    setLongitude(String(p.longitude));
  };

  const submit = async () => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!name.trim() || !shopPhone.trim() || !address.trim()) {
      notify({ title: "Shop name, phone and address are all required" });
      return;
    }
    if (categories.length === 0) {
      notify({ title: "Pick at least one category" });
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng) || (!lat && !lng)) {
      notify({ title: "Pick an area so we know where your shop is" });
      return;
    }

    setBusy(true);
    try {
      await api.post("/shops", {
        name: name.trim(),
        categories,
        description: description.trim(),
        phone: shopPhone.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        deliveryRange: range,
      });
      await reload();
    } catch (error) {
      notifyError(error, "Could not register your shop");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await signOut();
    // Back to browsing, not to a login wall - the shop is open to guests.
    router.replace("/customer");
  };

  /* ------------------------------------------------------- other states */

  // Still finding out whether there is a shop.
  if (state === "loading") {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  // Approved while sitting here - go straight into the merchant app rather
  // than showing the registration form again.
  if (state === "verified") {
    return <Redirect href="/merchant" />;
  }

  /* ------------------------------------------------- waiting for approval */

  if (state === "pending" || state === "suspended") {
    const suspended = state === "suspended";

    return (
      <View style={[styles.waitScreen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.waitMiddle}>
          <View
            style={[
              styles.waitIcon,
              suspended && { backgroundColor: status.danger.bg },
            ]}
          >
            <Ionicons
              name={suspended ? "close-circle-outline" : "hourglass-outline"}
              size={34}
              color={suspended ? status.danger.fg : colors.cream}
            />
          </View>

          <Text style={styles.waitTitle}>
            {suspended ? "Shop suspended" : "Waiting for verification"}
          </Text>

          <Text style={styles.waitSub}>
            {suspended
              ? "This shop has been suspended."
              : "We are reviewing your shop. You will be able to add products once it is approved."}
          </Text>

          <Text style={styles.waitShop}>{shop?.name}</Text>
        </View>

        <View style={styles.waitFooter}>
          <Button
            label="Check status"
            variant="outline"
            full
            icon="refresh-outline"
            loading={checking}
            onPress={async () => {
              setChecking(true);
              await reload();
              setChecking(false);
              // If it went through, the verified branch above takes over on
              // the next render and sends them into the app.
            }}
          />
          <Button
            label="Sign out"
            variant="danger"
            full
            icon="log-out-outline"
            onPress={leave}
          />
        </View>
      </View>
    );
  }

  /* ------------------------------------------------------ registration form */

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <InkHeader>
        <Text style={styles.title}>Register your shop</Text>
        <Text style={styles.subtitle}>
          One shop per merchant account. It is reviewed before it goes live.
        </Text>
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
        <Card style={{ gap: 12 }}>
          <Field
            label="Shop name"
            value={name}
            onChangeText={setName}
            placeholder="Kofi Electronics"
          />

          <View>
            <Text style={styles.fieldLabel}>What do you sell?</Text>
            <Text style={[styles.hint, { marginBottom: 8 }]}>
              Pick every category that applies - you will show up in all of them.
            </Text>
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
            placeholder="24 466 7712"
          />

          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What do you sell?"
            multiline
            numberOfLines={3}
          />
        </Card>

        <Card style={{ gap: 12 }}>
          <Text style={styles.cardTitle}>Where are you?</Text>
          <Text style={styles.hint}>
            Delivery is priced from the real distance between here and the
            customer, so this matters.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {PRESETS.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => usePreset(p)}
                style={[
                  styles.pill,
                  address === p.address && {
                    borderColor: colors.ink,
                    borderWidth: borderWidth.selected,
                  },
                ]}
              >
                <Text style={styles.pillText}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Field
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Oxford Street, Osu, Accra"
          />
          <View style={{ flexDirection: "row", gap: 9 }}>
            <Field
              label="Latitude"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numbers-and-punctuation"
              placeholder="5.5560"
              style={{ flex: 1 }}
            />
            <Field
              label="Longitude"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numbers-and-punctuation"
              placeholder="-0.1969"
              style={{ flex: 1 }}
            />
          </View>
        </Card>

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
            distance so you never have to.
          </Text>
        </Card>

        <Button
          label="Submit for verification"
          full
          loading={busy}
          onPress={submit}
        />

        <Button label="Sign out" variant="outline" full onPress={leave} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { ...type.pageTitle, color: colors.cream },
  subtitle: { fontSize: 11, color: "rgba(253,240,213,0.60)", lineHeight: 16 },

  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.creamDeep,
  },
  waitScreen: {
    flex: 1,
    backgroundColor: colors.creamDeep,
    paddingHorizontal: spacing.screen,
  },
  waitMiddle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  waitIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.panel,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  waitTitle: { fontSize: 18, fontWeight: "500", color: colors.textPrimary },
  waitSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  waitShop: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  waitFooter: { gap: 9 },

  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
  hint: { fontSize: 10, color: colors.textTertiary, lineHeight: 15 },
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
});
