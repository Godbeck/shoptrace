import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { borderWidth, colors } from "@/theme";

/**
 * Customer bottom navigation - design.md section 6.
 *
 * White surface, hairline tan TOP border, five items. Inactive is text-muted,
 * active is ink with the label at weight 500. Deliberately no pill background
 * and no colour fill behind the active item.
 */
export default function CustomerTabs() {
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
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={20} color={color} />,
        }}
      />
      {/* Profile is reachable from the avatar in the header, so it is not a
          tab. Four tabs also leaves each one more room. */}
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
