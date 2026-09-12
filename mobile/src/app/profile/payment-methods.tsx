/**
 * Saved payment methods.
 *
 * Mobile Money only, and that is a deliberate limit rather than an omission.
 * A MoMo number is not a secret in the way a card number is - it is the same
 * number a customer reads out to a merchant on the phone. Storing a card
 * number would put this project in PCI scope; the right answer is a Paystack
 * authorization token, which needs Paystack. So the option does not exist
 * rather than existing in a broken or unsafe form.
 */
import { useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/headers";
import { Button, Card, Divider, EmptyState, Field, StatusPill } from "@/components/ui";
import { borderWidth, colors, radius, spacing, status, type } from "@/theme";
import { phone as formatPhone } from "@/lib/format";
import { api, type ApiPaymentMethod } from "@/lib/api";
import { useSession } from "@/lib/session";

const PROVIDERS = ["MTN", "Vodafone", "AirtelTigo"] as const;

export default function PaymentMethods() {
  const insets = useSafeAreaInsets();
  const { paymentMethods, user, loadProfile, notify, notifyError } = useSession();

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("MTN");
  const [number, setNumber] = useState(user?.phone ?? "");

  const save = async () => {
    if (!number.trim()) {
      notify({ title: "Enter your mobile money number" });
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/me/payment-methods", { provider, phone: number });
      await loadProfile();
      setAdding(false);
      setNumber("");
      notify({ title: `${provider} number saved`, tone: "success" });
    } catch (error) {
      // The server rejects a duplicate and a badly formed number, with a
      // message worth showing verbatim.
      notifyError(error, "Could not save that number");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (method: ApiPaymentMethod) => {
    try {
      await api.patch(`/auth/me/payment-methods/${method._id}`, { isDefault: true });
      await loadProfile();
      notify({ title: "Default updated", tone: "success" });
    } catch (error) {
      notifyError(error);
    }
  };

  const remove = async (method: ApiPaymentMethod) => {
    try {
      await api.delete(`/auth/me/payment-methods/${method._id}`);
      await loadProfile();
      notify({ title: "Number removed" });
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Payment methods" />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {paymentMethods.length === 0 && !adding ? (
          <EmptyState
            icon="phone-portrait-outline"
            title="No mobile money number saved"
            action="Add one so checkout can use it"
          />
        ) : null}

        {paymentMethods.map((method) => (
          <Card key={method._id} style={{ gap: 10 }}>
            <View style={styles.head}>
              <View style={styles.well}>
                <Ionicons name="phone-portrait-outline" size={15} color={colors.ink} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{method.provider} Mobile Money</Text>
                  {method.isDefault ? (
                    <StatusPill label="Default" tone="success" />
                  ) : null}
                </View>
                <Text style={styles.number}>{formatPhone(method.phone)}</Text>
              </View>
            </View>

            <Divider style={{ marginVertical: 0 }} />

            <View style={styles.actions}>
              {!method.isDefault ? (
                <Pressable onPress={() => makeDefault(method)} hitSlop={6}>
                  <Text style={styles.link}>Make default</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable
                onPress={() => remove(method)}
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
            <Text style={styles.formTitle}>New mobile money number</Text>

            <View>
              <Text style={styles.providerLabel}>Provider</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PROVIDERS.map((p) => {
                  const selected = provider === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setProvider(p)}
                      style={[
                        styles.provider,
                        selected
                          ? { backgroundColor: colors.ink, borderColor: colors.ink }
                          : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.providerText,
                          { color: selected ? colors.cream : colors.textPrimary },
                        ]}
                      >
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Field
              label="Number"
              prefix="+233"
              value={number}
              onChangeText={setNumber}
              keyboardType="phone-pad"
              placeholder="24 411 8820"
            />

            <View style={{ flexDirection: "row", gap: 9 }}>
              <Button
                label="Cancel"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setAdding(false)}
              />
              <Button
                label="Save number"
                style={{ flex: 1 }}
                loading={busy}
                onPress={save}
              />
            </View>
          </Card>
        ) : (
          <Button
            label="Add a mobile money number"
            icon="add"
            full
            onPress={() => setAdding(true)}
          />
        )}

        <View style={styles.cardNote}>
          <Ionicons name="card-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.cardNoteText}>
            Only mobile money numbers can be saved. Card details are never
            stored on your device or ours.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: 11, alignItems: "center" },
  well: {
    width: 32,
    height: 32,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label: { ...type.cardTitle, color: colors.textPrimary },
  number: { fontSize: 11, color: colors.textSecondary },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  link: { fontSize: 11, fontWeight: "500", color: colors.ink },
  removeButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  removeText: { fontSize: 11, fontWeight: "500", color: status.danger.fg },
  formTitle: { ...type.cardTitle, color: colors.textPrimary },
  providerLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: 7,
  },
  provider: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingVertical: 10,
  },
  providerText: { fontSize: 12, fontWeight: "500" },
  cardNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    paddingHorizontal: 2,
  },
  cardNoteText: {
    flex: 1,
    fontSize: 10,
    color: colors.textTertiary,
    lineHeight: 15,
  },
});
