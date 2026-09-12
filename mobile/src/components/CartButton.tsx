import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { useCart } from "@/lib/cart";

/**
 * The cart icon with its count badge, for the customer header.
 *
 * Lives in its own file because it appears on several screens and the badge
 * has to stay in sync everywhere - reading from the cart context is what
 * guarantees that.
 */
export const CartButton = ({ tint = colors.ink }: { tint?: string }) => {
  const router = useRouter();
  const { count } = useCart();

  return (
    <Pressable onPress={() => router.push("/cart")} hitSlop={8} style={styles.wrap}>
      <Ionicons name="bag-outline" size={21} color={tint} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
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
    borderWidth: 1.5,
    borderColor: colors.cream,
  },
  badgeText: { fontSize: 9, fontWeight: "500", color: colors.cream },
});
