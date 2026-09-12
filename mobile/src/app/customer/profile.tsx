/**
 * Profile. Real account details, with working links to addresses and payment
 * methods.
 *
 * It also carries the surface switcher, which is how you reach the merchant
 * side without registering a second account.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/headers";
import { Button, Card, Divider, Field, ImageWell } from "@/components/ui";
import { colors, radius, spacing, type } from "@/theme";
import { phone as formatPhone } from "@/lib/format";
import { api, BASE_URL } from "@/lib/api";
import { useSession } from "@/lib/session";
import { SignInRequired } from "@/components/SignInRequired";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user,
    signedIn,
    addresses,
    paymentMethods,
    setSurface,
    signOut,
    refreshUser,
    notify,
    notifyError,
  } = useSession();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch("/auth/me", { name, phone: phoneNumber });
      await refreshUser();
      setEditing(false);
      notify({ title: "Profile updated", tone: "success" });
    } catch (error) {
      notifyError(error, "Could not save your details");
    } finally {
      setBusy(false);
    }
  };

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const defaultMethod = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];

  if (!signedIn) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Profile" onBack={() => router.replace("/customer")} />
        <SignInRequired
          icon="person-outline"
          title="Save your details"
          body="An account keeps your delivery address and mobile money number ready, so checking out takes one tap instead of five."
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Profile" onBack={() => router.replace("/customer")} />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // Editing name and phone happens part-way down the page.
        automaticallyAdjustKeyboardInsets
      >
        <Card style={{ gap: 12 }}>
          {editing ? (
            <>
              <Text style={styles.formTitle}>Your details</Text>
              <Field label="Full name" value={name} onChangeText={setName} />
              <Field
                label="Phone number"
                prefix="+233"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
              <Text style={styles.emailNote}>
                To change your email or password, get in touch with support.
              </Text>
              <View style={{ flexDirection: "row", gap: 9 }}>
                <Button
                  label="Cancel"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setEditing(false)}
                />
                <Button
                  label="Save"
                  style={{ flex: 1 }}
                  loading={busy}
                  onPress={save}
                />
              </View>
            </>
          ) : (
            <View style={styles.identity}>
              <ImageWell size={56} icon="person-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name}>{user?.name}</Text>
                <Text style={styles.contact}>{user?.email}</Text>
                <Text style={styles.contact}>
                  {user?.phone ? formatPhone(user.phone) : ""}
                </Text>
              </View>
              <Button
                label="Edit"
                variant="outline"
                small
                onPress={() => {
                  setName(user?.name ?? "");
                  setPhoneNumber(user?.phone ?? "");
                  setEditing(true);
                }}
              />
            </View>
          )}
        </Card>

        <Card padded={false} style={{ paddingHorizontal: spacing.card }}>
          <Row
            icon="location-outline"
            label="Delivery addresses"
            value={
              defaultAddress
                ? `${addresses.length} saved · ${defaultAddress.label}`
                : "None saved"
            }
            onPress={() => router.push("/profile/addresses")}
          />
          <Divider style={{ marginVertical: 0 }} />
          <Row
            icon="card-outline"
            label="Payment methods"
            value={
              defaultMethod
                ? `${defaultMethod.provider} · ${formatPhone(defaultMethod.phone)}`
                : "None saved"
            }
            onPress={() => router.push("/profile/payment-methods")}
          />
          <Divider style={{ marginVertical: 0 }} />
          <Row
            icon="receipt-outline"
            label="My orders"
            value=""
            onPress={() => router.push("/customer/orders")}
          />
          <Divider style={{ marginVertical: 0 }} />
          <Row
            icon="notifications-outline"
            label="Price alerts"
            value=""
            onPress={() => router.push("/customer/alerts")}
          />
        </Card>

        {/* Surface switcher - how you reach the merchant side. */}
        <Card style={{ gap: 11 }}>
          <View style={styles.switchRow}>
            <View style={styles.switchWell}>
              <Ionicons name="storefront-outline" size={17} color={colors.cream} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.switchTitle}>Switch to merchant</Text>
              <Text style={styles.switchSub}>
                {user?.role === "merchant"
                  ? "Manage your shop and its orders"
                  : "You will need a merchant account to list products"}
              </Text>
            </View>
            <Button
              label="Open"
              small
              onPress={() => {
                setSurface("merchant");
                router.replace("/merchant");
              }}
            />
          </View>
        </Card>

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
    </View>
  );
}

const Row = ({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
  >
    <View style={styles.rowWell}>
      <Ionicons name={icon} size={15} color={colors.ink} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    {value ? (
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    ) : null}
    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
  </Pressable>
);

const styles = StyleSheet.create({
  identity: { flexDirection: "row", gap: 12, alignItems: "center" },
  name: { fontSize: 15, fontWeight: "500", color: colors.textPrimary },
  contact: { fontSize: 11, color: colors.textTertiary },
  formTitle: { ...type.cardTitle, color: colors.textPrimary },
  emailNote: { fontSize: 10, color: colors.textTertiary, lineHeight: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13 },
  rowWell: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 12.5, color: colors.textPrimary },
  rowValue: { fontSize: 11, color: colors.textTertiary, maxWidth: 150 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  switchWell: {
    width: 38,
    height: 38,
    borderRadius: radius.well,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  switchTitle: { ...type.cardTitle, color: colors.textPrimary },
  switchSub: { fontSize: 10, color: colors.textTertiary },
  server: { fontSize: 10, color: colors.textMuted, textAlign: "center" },
});
