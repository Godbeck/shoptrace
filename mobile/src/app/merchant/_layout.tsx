import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { borderWidth, colors } from "@/theme";
import { useShop } from "@/lib/shop";
import { useSession } from "@/lib/session";

/**
 * Merchant bottom navigation, plus the gate.
 *
 * The gate redirects to /merchant-setup, which lives OUTSIDE this folder on
 * purpose. A layout that returns <Redirect> renders no navigator, so any route
 * nested under it has nothing to mount into - pointing the redirect at a child
 * of this same layout crashes and then loops. Keeping setup outside also means
 * it shows with no tab bar, which is what an unverified merchant should see.
 */
export default function MerchantTabs() {
  const { user } = useSession();
  const { state } = useShop();

  // A shop cannot exist without an account, so there is no guest merchant.
  if (!user) {
    return <Redirect href="/auth/login" />;
  }
  if (user.role !== "merchant") {
    return <Redirect href="/customer" />;
  }

  if (state === "loading") {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (state !== "verified") {
    return <Redirect href="/merchant-setup" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: borderWidth.hairline,
          borderTopColor: colors.border,
          // Taller, with the items sitting higher off the bottom edge so they
          // clear the home indicator rather than hugging it.
          height: 76,
          paddingTop: 10,
          paddingBottom: 18,
          paddingHorizontal: 10,
          elevation: 0,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 10, marginTop: 3 },
        sceneStyle: { backgroundColor: colors.creamDeep },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: "Listings",
          tabBarIcon: ({ color }) => <Ionicons name="pricetags-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.creamDeep,
  },
});
