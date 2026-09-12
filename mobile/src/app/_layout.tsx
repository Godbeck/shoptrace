import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SessionProvider } from "@/lib/session";
import { CartProvider } from "@/lib/cart";
import { ShopProvider } from "@/lib/shop";
import { NotificationsProvider } from "@/lib/notifications";
import { NotificationBanner } from "@/components/NotificationBanner";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ShopProvider>
          <NotificationsProvider>
          <CartProvider>
            {/* The default. CreamHeader and InkHeader each override this
                while they are on screen, so the notch always contrasts with
                whatever is behind it. */}
            <StatusBar style="dark" />

            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.creamDeep },
                animation: "slide_from_right",
              }}
            />

            {/* Above every screen - this is where the OTP shows up. */}
            <NotificationBanner />
          </CartProvider>
          </NotificationsProvider>
          </ShopProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
