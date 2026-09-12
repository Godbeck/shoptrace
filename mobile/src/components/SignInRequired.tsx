import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./ui";
import { colors, radius, spacing } from "@/theme";

/**
 * Shown in place of a screen that genuinely needs an account.
 *
 * Browsing is deliberately open - a first-time visitor sees real products near
 * them before being asked for anything. The account is only required at the
 * point where it actually means something: an order to track, an alert to send
 * you, an address to deliver to.
 */
export const SignInRequired = ({
  icon = "lock-closed-outline",
  title,
  body,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.middle}>
        <View style={styles.iconWell}>
          <Ionicons name={icon} size={30} color={colors.cream} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Create an account"
          full
          onPress={() => router.push("/auth/register")}
        />
        <Button
          label="I already have one"
          variant="outline"
          full
          onPress={() => router.push("/auth/login")}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.creamDeep,
    paddingHorizontal: spacing.screen,
  },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  iconWell: {
    width: 70,
    height: 70,
    borderRadius: radius.panel,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: "500", color: colors.textPrimary },
  body: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 290,
  },
  actions: { gap: 9 },
});
