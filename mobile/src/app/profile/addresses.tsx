/**
 * Delivery addresses.
 *
 * Real CRUD against /api/auth/me/addresses. Coordinates matter here more than
 * the text does: the server prices delivery from the distance between the shop
 * and these exact coordinates, so a wrong pin means a wrong fee.
 *
 * There is no map picker yet, so the coordinates are typed. A few Accra areas
 * are offered as one-tap presets, because typing latitude and longitude by
 * hand is a miserable way to test a checkout flow.
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
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/headers";
import { Button, Card, Divider, EmptyState, Field, StatusPill } from "@/components/ui";
import { borderWidth, colors, radius, spacing, status, type } from "@/theme";
import { api, type ApiAddress } from "@/lib/api";
import { useSession } from "@/lib/session";

/** Real Accra coordinates, so a test order prices sensibly. */
const PRESETS = [
  { label: "Osu", address: "Oxford Street, Osu, Accra", latitude: 5.556, longitude: -0.1969 },
  { label: "East Legon", address: "Lagos Avenue, East Legon, Accra", latitude: 5.6363, longitude: -0.1608 },
  { label: "Madina", address: "Madina Market, Accra", latitude: 5.6836, longitude: -0.1667 },
  { label: "Tema", address: "Community 1, Tema", latitude: 5.6698, longitude: -0.0166 },
  { label: "Kasoa", address: "Kasoa Main Market", latitude: 5.5333, longitude: -0.4167 },
];

export default function Addresses() {
  const insets = useSafeAreaInsets();
  const { addresses, loadProfile, notify, notifyError } = useSession();

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Home");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const usePreset = (p: (typeof PRESETS)[number]) => {
    setAddress(p.address);
    setLatitude(String(p.latitude));
    setLongitude(String(p.longitude));
  };

  const save = async () => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!address.trim()) {
      notify({ title: "Enter the address" });
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng) || (!lat && !lng)) {
      notify({ title: "Pick an area, or enter coordinates" });
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/me/addresses", {
        label: label.trim() || "Home",
        address: address.trim(),
        latitude: lat,
        longitude: lng,
      });
      await loadProfile();
      setAdding(false);
      setAddress("");
      setLatitude("");
      setLongitude("");
      notify({ title: "Address saved", tone: "success" });
    } catch (error) {
      notifyError(error, "Could not save that address");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (item: ApiAddress) => {
    try {
      await api.patch(`/auth/me/addresses/${item._id}`, { isDefault: true });
      await loadProfile();
      notify({ title: `${item.label} is now your default`, tone: "success" });
    } catch (error) {
      notifyError(error);
    }
  };

  const remove = async (item: ApiAddress) => {
    try {
      await api.delete(`/auth/me/addresses/${item._id}`);
      await loadProfile();
      notify({ title: "Address removed" });
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Delivery addresses" />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {addresses.length === 0 && !adding ? (
          <EmptyState
            icon="location-outline"
            title="No addresses saved"
            action="Add one so checkout knows where to deliver"
          />
        ) : null}

        {addresses.map((item) => (
          <Card key={item._id} style={{ gap: 10 }}>
            <View style={styles.head}>
              <View style={styles.well}>
                <Ionicons name="location-outline" size={15} color={colors.ink} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{item.label}</Text>
                  {item.isDefault ? (
                    <StatusPill label="Default" tone="success" />
                  ) : null}
                </View>
                <Text style={styles.address}>{item.address}</Text>
                <Text style={styles.coords}>
                  {item.location.coordinates[1].toFixed(4)},{" "}
                  {item.location.coordinates[0].toFixed(4)}
                </Text>
              </View>
            </View>

            <Divider style={{ marginVertical: 0 }} />

            <View style={styles.actions}>
              {!item.isDefault ? (
                <Pressable onPress={() => makeDefault(item)} hitSlop={6}>
                  <Text style={styles.link}>Make default</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable
                onPress={() => remove(item)}
                hitSlop={6}
                style={styles.removeButton}
              >
                <Ionicons name="trash-outline" size={13} color={status.danger.fg} />
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </Card>
        ))}

        {adding ? (
          <Card style={{ gap: 12 }}>
            <Text style={styles.formTitle}>New address</Text>

            <View>
              <Text style={styles.presetLabel}>Pick an area</Text>
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
                      styles.preset,
                      address === p.address && {
                        borderColor: colors.ink,
                        borderWidth: borderWidth.selected,
                      },
                    ]}
                  >
                    <Text style={styles.presetText}>{p.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <Field label="Label" value={label} onChangeText={setLabel} placeholder="Home" />
            <Field
              label="Address"
              value={address}
              onChangeText={setAddress}
              placeholder="House 24, Ringway Estates, Osu"
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

            <View style={{ flexDirection: "row", gap: 9 }}>
              <Button
                label="Cancel"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setAdding(false)}
              />
              <Button
                label="Save address"
                style={{ flex: 1 }}
                loading={busy}
                onPress={save}
              />
            </View>
          </Card>
        ) : (
          <Button
            label="Add an address"
            icon="add"
            full
            onPress={() => setAdding(true)}
          />
        )}

        <Text style={styles.note}>
          Delivery is priced from how far the shop is from this spot, so pick
          the closest area to you.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  well: {
    width: 32,
    height: 32,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { ...type.cardTitle, color: colors.textPrimary },
  address: { fontSize: 11, color: colors.textSecondary },
  coords: { fontSize: 10, color: colors.textMuted },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  link: { fontSize: 11, fontWeight: "500", color: colors.ink },
  removeButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  removeText: { fontSize: 11, fontWeight: "500", color: status.danger.fg },
  formTitle: { ...type.cardTitle, color: colors.textPrimary },
  presetLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: 7,
  },
  preset: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  presetText: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  note: {
    fontSize: 10,
    color: colors.textTertiary,
    lineHeight: 15,
    paddingHorizontal: 2,
  },
});
