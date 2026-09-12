/**
 * Screen 1 - Login. Talks to POST /api/auth/login.
 *
 * Cream hero, cream-deep body, and no bottom navigation - this is
 * pre-authentication chrome.
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
import { Button, Field } from "@/components/ui";
import { LogoMark } from "@/components/headers";
import { borderWidth, colors, spacing } from "@/theme";
import { BASE_URL } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, notify, notifyError } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      notify({ title: "Enter your email and password to continue" });
      return;
    }

    setBusy(true);
    try {
      const account = await signIn(email, password);
      notify({ title: `Welcome back, ${account.name.split(" ")[0]}`, tone: "success" });
      router.replace(account.role === "merchant" ? "/merchant" : "/customer");
    } catch (error) {
      // The server returns the same message for a wrong password and an
      // unknown email on purpose, so this shows exactly what it said.
      notifyError(error, "Could not sign you in");
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
        <View style={[styles.hero, { paddingTop: insets.top + 44 }]}>
          <LogoMark size={46} />
          <Text style={styles.wordmark}>ShopTrace</Text>
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSub}>
            Find what you need nearby, at the best price.
          </Text>
        </View>

        <View style={styles.body}>
          <Field
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
          />

          <Field
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!reveal}
            placeholder="Your password"
            rightIcon={reveal ? "eye-off-outline" : "eye-outline"}
            onRightIconPress={() => setReveal((r) => !r)}
          />

          <Pressable
            style={styles.forgot}
            onPress={() =>
              notify({
                title: "Password reset needs an email provider",
                body: "Not connected yet.",
              })
            }
          >
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <Button label="Sign in" onPress={onSignIn} full loading={busy} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable onPress={() => router.push("/auth/register")}>
              <Text style={[styles.link, styles.underline]}>Sign up</Text>
            </Pressable>
          </View>

          {/* Where the app is pointing. On a phone this is the first thing to
              check when nothing loads, so it is shown rather than hidden. */}
          <View style={styles.serverRow}>
            <View style={styles.rule} />
            <Text style={styles.serverText}>{BASE_URL}</Text>
            <View style={styles.rule} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.cream,
    alignItems: "center",
    paddingBottom: 34,
    paddingHorizontal: spacing.screen,
    gap: 6,
  },
  wordmark: { fontSize: 17, fontWeight: "500", color: colors.ink, marginTop: 10 },
  heroTitle: { fontSize: 20, fontWeight: "500", color: colors.ink, marginTop: 14 },
  heroSub: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  body: { padding: spacing.screen, gap: 14 },
  forgot: { alignSelf: "flex-end", marginTop: -4 },
  link: { fontSize: 12, fontWeight: "500", color: colors.ink },
  underline: { textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  footerText: { fontSize: 12, color: colors.textSecondary },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  rule: { flex: 1, height: borderWidth.hairline, backgroundColor: colors.border },
  serverText: { fontSize: 10, color: colors.textMuted },
});
