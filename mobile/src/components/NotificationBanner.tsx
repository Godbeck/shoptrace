/**
 * The in-app notification banner.
 *
 * Until an SMS provider exists, this is where the OTP appears. It is styled
 * as an ink card so it reads as system chrome rather than page content, and
 * it never uses a status colour as a surface - section 22.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";
import { useSession } from "@/lib/session";

export const NotificationBanner = () => {
  const { notification, dismiss } = useSession();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: notification ? 0 : -160,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [notification, slide]);

  if (!notification) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingTop: insets.top + 6, transform: [{ translateY: slide }] },
      ]}
    >
      <Pressable onPress={dismiss} style={styles.card}>
        <View style={styles.head}>
          <View style={styles.iconWell}>
            <Ionicons
              name={notification.code ? "keypad-outline" : "notifications"}
              size={14}
              color={colors.ink}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{notification.title}</Text>
            {notification.body ? (
              <Text style={styles.body}>{notification.body}</Text>
            ) : null}
          </View>
          <Ionicons name="close" size={15} color={colors.textMuted} />
        </View>

        {notification.code ? (
          <View style={styles.codeRow}>
            {notification.code.split("").map((digit, i) => (
              <View key={i} style={styles.codeBox}>
                <Text style={styles.codeText}>{digit}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: spacing.gutter,
  },
  card: {
    backgroundColor: colors.ink,
    borderRadius: radius.panel,
    padding: 13,
    gap: 11,
  },
  head: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  iconWell: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 13, fontWeight: "500", color: colors.cream },
  body: { fontSize: 11, color: "rgba(253,240,213,0.62)", marginTop: 2, lineHeight: 15 },
  codeRow: { flexDirection: "row", gap: 6 },
  codeBox: {
    flex: 1,
    height: 40,
    borderRadius: radius.button,
    backgroundColor: "rgba(253,240,213,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  codeText: { fontSize: 18, fontWeight: "500", color: colors.cream },
});
