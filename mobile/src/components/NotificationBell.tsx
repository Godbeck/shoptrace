import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { useNotifications } from "@/lib/notifications";

/**
 * The bell, with a count of things you have not seen.
 *
 * A guest has no orders and no alerts, so the count is naturally zero and the
 * badge never appears - no special case needed.
 */
export const NotificationBell = ({ tint = colors.ink }: { tint?: string }) => {
  const router = useRouter();
  const { unreadCount } = useNotifications();

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      style={styles.wrap}
    >
      <Ionicons name="notifications-outline" size={20} color={tint} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  badge: {
    position: "absolute",
    top: -5,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    // A ring in the header colour, so the badge reads as separate from the
    // icon rather than merging into it.
    borderWidth: 1.5,
    borderColor: colors.cream,
  },
  badgeText: { fontSize: 9, fontWeight: "500", color: colors.cream },
});
