/**
 * OTP verification.
 *
 * Not in the original 20-screen inventory - added because there is no SMS
 * provider yet. The code is generated locally and delivered through the
 * in-app notification banner, so the whole flow can be walked end to end.
 *
 * When an SMS provider is connected, only two things change: `requestOtp`
 * calls the server, and the banner stops carrying the code. This screen does
 * not change at all.
 */
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui";
import { borderWidth, colors, radius, spacing } from "@/theme";
import { phone as formatPhone } from "@/lib/format";
import { useSession, type Role } from "@/lib/session";

const LENGTH = 6;

export default function Otp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ role?: Role; name?: string; phone?: string }>();
  // The number being verified travels as a route param. The session no longer
  // holds it, because the server never sees this code - it is a local gate.
  const phone = params.phone ?? "";
  const { pendingOtp, verifyOtp, requestOtp, notify } = useSession();

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [seconds, setSeconds] = useState(45);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const code = digits.join("");

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (clean && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const onKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const onVerify = () => {
    if (!verifyOtp(code)) {
      notify({ title: "That code is not right", body: "Check the code and try again." });
      return;
    }
    // The number is confirmed. The account itself was already created on the
    // server by the register screen, so this only unblocks the UI.
    notify({ title: "Number verified", tone: "success" });
    const role = (params.role as Role) ?? "customer";
    router.replace(role === "merchant" ? "/merchant" : "/customer");
  };

  const onResend = () => {
    requestOtp(phone);
    setDigits(Array(LENGTH).fill(""));
    setSeconds(45);
    inputs.current[0]?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.heroTitle}>Verify your number</Text>
        <Text style={styles.heroSub}>
          We sent a 6-digit code to {formatPhone(phone)}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.codeRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={digit}
              onChangeText={(v) => setDigit(i, v)}
              onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={i === 0}
              style={[
                styles.codeBox,
                // Selected state is a 1.5px ink border, never a coloured fill.
                digit
                  ? { borderColor: colors.ink, borderWidth: borderWidth.selected }
                  : null,
              ]}
            />
          ))}
        </View>

        {/* An honest note about why the code is on screen rather than in an SMS. */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={15} color={colors.ink} />
          <Text style={styles.noteText}>
            No SMS provider is connected yet, so your code arrives as a
            notification at the top of the screen.
            {pendingOtp ? ` This one is ${pendingOtp}.` : ""}
          </Text>
        </View>

        <Button
          label="Verify and continue"
          onPress={onVerify}
          full
          disabled={code.length < LENGTH}
        />

        <View style={styles.resendRow}>
          {seconds > 0 ? (
            <Text style={styles.resendMuted}>Resend code in {seconds}s</Text>
          ) : (
            <Pressable onPress={onResend}>
              <Text style={styles.resendLink}>Resend code</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

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
  body: { padding: spacing.screen, gap: 18 },
  codeRow: { flexDirection: "row", gap: 8 },
  codeBox: {
    flex: 1,
    height: 54,
    borderRadius: radius.input,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.white,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  noteCard: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: colors.cream,
    borderRadius: radius.card,
    padding: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  resendRow: { alignItems: "center" },
  resendMuted: { fontSize: 12, color: colors.textTertiary },
  resendLink: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.ink,
    textDecorationLine: "underline",
  },
});
