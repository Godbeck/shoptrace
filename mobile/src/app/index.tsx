import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { colors } from "@/theme";

/**
 * Decides which of the three worlds you land in. It waits for `ready` first,
 * because the session restores a saved token from storage on launch - without
 * that wait, a signed-in user would be bounced to login for a frame.
 */
export default function Index() {
  const { ready, signedIn, surface } = useSession();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.creamDeep,
        }}
      >
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  // Browsing is open. Someone who has never signed up lands on the customer
  // home and sees real products near them - which is the one thing that would
  // make them stay. An account is asked for later, at the point where it means
  // something: an order to track, an alert to send, an address to deliver to.
  //
  // Merchant is never a guest state, because a shop cannot exist without an
  // account, so only the customer surface has a signed-out version.
  if (!signedIn) return <Redirect href="/customer" />;
  return <Redirect href={surface === "merchant" ? "/merchant" : "/customer"} />;
}
