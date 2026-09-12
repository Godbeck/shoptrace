/**
 * Notifications.
 *
 * The feed is built in lib/notifications.tsx, so the bell's badge and this
 * screen always agree about what exists and what is unread.
 *
 * Opening the screen marks everything read - the badge is about "seen", not
 * "acted on".
 */
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/headers";
import { Card, EmptyState } from "@/components/ui";
import { SignInRequired } from "@/components/SignInRequired";
import { colors, radius, spacing, type } from "@/theme";
import { relativeTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useNotifications } from "@/lib/notifications";

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signedIn } = useSession();
  const { items, loading, reload, markAllRead } = useNotifications();

  // Seeing them is what counts as reading them.
  useEffect(() => {
    if (signedIn) markAllRead();
  }, [signedIn, markAllRead]);

  if (!signedIn) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Notifications" />
        <SignInRequired
          icon="notifications-outline"
          title="We will keep you posted"
          body="Order updates and price drops land here. Create an account so we have somewhere to send them."
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Notifications" />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 8,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={reload}
            tintColor={colors.ink}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && items.length === 0 ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="Nothing yet"
            action="Updates on your orders and price alerts show up here"
          />
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => item.href && router.push(item.href as any)}
            >
              <Card>
                <View style={styles.row}>
                  <View style={styles.well}>
                    <Ionicons
                      name={item.icon as any}
                      size={16}
                      color={colors.ink}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                    <Text style={styles.time}>{relativeTime(item.at)}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={colors.textMuted}
                  />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 11, alignItems: "center" },
  well: {
    width: 34,
    height: 34,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.cardTitle, color: colors.textPrimary },
  body: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  time: { fontSize: 10, color: colors.textTertiary },
});
