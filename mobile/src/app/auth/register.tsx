/**
 * Screen 2 - Register.
 *
 * The role selector comes FIRST, before any field. It changes what the account
 * is, so asking it last would be asking it too late. Selected card is ink
 * filled with cream contents - section 5's selected-state rule.
 *
 * Phone is required, not optional: Ghanaian identity and Mobile Money both
 * depend on it.
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Field } from "@/components/ui";
import { borderWidth, colors, radius, spacing } from "@/theme";
import { useSession, type Role } from "@/lib/session";

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, requestOtp, notify, notifyError } = useSession();

  const [role, setRole] = useState<Role>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!name.trim() || !email.trim() || !phoneNumber.trim() || !password.trim()) {
      notify({ title: "Fill in every field to continue" });
      return;
    }
    if (password.length < 6) {
      // Mirrors the server's own rule, so the app never sends a request the
      // API is guaranteed to reject.
      notify({ title: "Password must be at least 6 characters long" });
      return;
    }

    setBusy(true);
    try {
      // The account is created on the server here - this is a real user in
      // MongoDB, and the session now holds a real JWT.
      await register({ name, email, phone: phoneNumber, password, role });

      // Then the number is confirmed. With no SMS provider the code arrives
      // as an in-app notification, so the step is a UI gate rather than
      // something the server checks.
      requestOtp(phoneNumber);
      router.push({
        pathname: "/auth/otp",
        params: { role, name, phone: phoneNumber },
      });
    } catch (error) {
      notifyError(error, "Could not create your account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.heroTitle}>Create account</Text>
          <Text style={styles.heroSub}>
            Compare prices near you, or start selling in minutes.
          </Text>
        </View>

        <View style={styles.body}>
          <View>
            <Text style={styles.groupLabel}>I am signing up as</Text>
            <View style={styles.roleRow}>
              <RoleCard
                icon="bag-handle-outline"
                label="Customer"
                selected={role === "customer"}
                onPress={() => setRole("customer")}
              />
              <RoleCard
                icon="storefront-outline"
                label="Merchant"
                selected={role === "merchant"}
                onPress={() => setRole("merchant")}
              />
            </View>
          </View>

          <Field
            label="Full name"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder="Ama Mensah"
          />
          <Field
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Phone number"
            prefix="+233"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            placeholder="24 411 8820"
          />
          <Field
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!reveal}
            placeholder="At least 6 characters"
            rightIcon={reveal ? "eye-off-outline" : "eye-outline"}
            onRightIconPress={() => setReveal((r) => !r)}
          />

          <Button label="Create account" onPress={onCreate} full loading={busy} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => router.replace("/auth/login")}>
              <Text style={styles.linkUnderline}>Sign in</Text>
            </Pressable>
          </View>

          <Text style={styles.terms}>
            By creating an account you agree to our Terms of Service and Privacy
            Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const RoleCard = ({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.roleCard,
      selected
        ? { backgroundColor: colors.ink, borderColor: colors.ink }
        : { backgroundColor: colors.white, borderColor: colors.border },
    ]}
  >
    <Ionicons
      name={icon}
      size={22}
      color={selected ? colors.cream : colors.textSecondary}
    />
    <Text
      style={[
        styles.roleLabel,
        { color: selected ? colors.cream : colors.textPrimary },
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.screen,
    paddingBottom: 26,
    gap: 5,
  },
  back: { alignSelf: "flex-start", marginBottom: 18 },
  heroTitle: { fontSize: 20, fontWeight: "500", color: colors.ink },
  heroSub: { fontSize: 12, color: colors.textSecondary },
  body: { padding: spacing.screen, gap: 14 },
  groupLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: 8,
  },
  roleRow: { flexDirection: "row", gap: 10 },
  roleCard: {
    flex: 1,
    alignItems: "center",
    gap: 7,
    paddingVertical: 18,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
  },
  roleLabel: { fontSize: 13, fontWeight: "500" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 4 },
  footerText: { fontSize: 12, color: colors.textSecondary },
  linkUnderline: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.ink,
    textDecorationLine: "underline",
  },
  terms: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 15,
  },
});
