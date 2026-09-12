/**
 * The two-surface rule - design.md section 3.
 *
 * Customer screens get a CREAM header with an ink logo mark.
 * Merchant screens get an INK header with a cream logo mark.
 *
 * Page bodies stay cream-deep in both cases. Only the chrome flips. This is
 * load-bearing: it tells users instantly which side of the marketplace they
 * are on, without a label saying so.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { borderWidth, colors, radius, spacing, type } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** The logo mark: a rounded square, inverted per surface. */
export const LogoMark = ({
  surface = "cream",
  size = 30,
}: {
  surface?: "cream" | "ink";
  size?: number;
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: radius.button,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: surface === "cream" ? colors.ink : colors.cream,
    }}
  >
    <Ionicons
      name="pricetag"
      size={size * 0.5}
      color={surface === "cream" ? colors.cream : colors.ink}
    />
  </View>
);

const HeaderIcon = ({
  name,
  tint,
  onPress,
  badge,
}: {
  name: IconName;
  tint: string;
  onPress?: () => void;
  badge?: number;
}) => (
  <Pressable onPress={onPress} hitSlop={8} style={styles.headerIcon}>
    <Ionicons name={name} size={20} color={tint} />
    {badge ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    ) : null}
  </Pressable>
);

/* ----------------------------------------------------- customer surface */

export const CreamHeader = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.cream, paddingTop: insets.top + 8 },
        style,
      ]}
    >
      {/* The header runs up under the notch, so the clock, battery and
          signal sit ON this surface. Cream is light, so they must be dark. */}
      <StatusBar style="dark" />
      {children}
    </View>
  );
};

/* ----------------------------------------------------- merchant surface */

export const InkHeader = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.ink, paddingTop: insets.top + 8 },
        style,
      ]}
    >
      {/* Same surface, opposite problem: this one is near-black, so the
          clock, battery and signal have to be LIGHT or they vanish into it.
          Setting it here rather than globally means it follows whichever
          header is on screen - the two-surface rule extends to the notch. */}
      <StatusBar style="light" />
      {children}
    </View>
  );
};

/**
 * A back button, a title, and optional trailing icons. Used on every screen
 * that is pushed rather than tabbed to.
 */
export const ScreenHeader = ({
  title,
  surface = "cream",
  actions = [],
  trailingText,
  onBack,
  right,
}: {
  title?: string;
  surface?: "cream" | "ink";
  actions?: { icon: IconName; onPress?: () => void; badge?: number }[];
  trailingText?: string;
  onBack?: () => void;
  /** Anything that belongs at the far right - the cart button, usually. */
  right?: React.ReactNode;
}) => {
  const router = useRouter();
  const tint = surface === "cream" ? colors.ink : colors.cream;
  const Wrapper = surface === "cream" ? CreamHeader : InkHeader;

  return (
    <Wrapper>
      <View style={styles.row}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={10}
          style={styles.headerIcon}
        >
          <Ionicons name="chevron-back" size={22} color={tint} />
        </Pressable>

        {title ? (
          <Text style={[type.pageTitle, { color: tint, flex: 1 }]}>{title}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {trailingText ? (
          <Text
            style={{
              fontSize: 11,
              color: surface === "cream" ? colors.textTertiary : colors.textMuted,
            }}
          >
            {trailingText}
          </Text>
        ) : null}

        {actions.map((a, i) => (
          <HeaderIcon
            key={i}
            name={a.icon}
            tint={tint}
            onPress={a.onPress}
            badge={a.badge}
          />
        ))}

        {right}
      </View>
    </Wrapper>
  );
};

/** A title with trailing icons and no back button - for tab root screens. */
export const TabHeader = ({
  title,
  surface = "cream",
  actions = [],
}: {
  title: string;
  surface?: "cream" | "ink";
  actions?: { icon: IconName; onPress?: () => void; badge?: number }[];
}) => {
  const tint = surface === "cream" ? colors.ink : colors.cream;
  const Wrapper = surface === "cream" ? CreamHeader : InkHeader;

  return (
    <Wrapper>
      <View style={styles.row}>
        <Text style={[type.pageTitle, { color: tint, flex: 1 }]}>{title}</Text>
        {actions.map((a, i) => (
          <HeaderIcon
            key={i}
            name={a.icon}
            tint={tint}
            onPress={a.onPress}
            badge={a.badge}
          />
        ))}
      </View>
    </Wrapper>
  );
};

/** Tabs marked by a 2px ink underline segment - section 6. */
export const Tabs = ({
  items,
  value,
  onChange,
  surface = "cream",
}: {
  items: string[];
  value: string;
  onChange: (next: string) => void;
  surface?: "cream" | "ink";
}) => {
  const onInk = surface === "ink";
  return (
    <View
      style={[
        styles.tabs,
        {
          backgroundColor: onInk ? colors.ink : colors.cream,
          borderBottomColor: onInk ? "rgba(255,255,255,0.14)" : colors.border,
        },
      ]}
    >
      {items.map((item) => {
        const active = item === value;
        const activeTint = onInk ? colors.cream : colors.ink;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            style={styles.tab}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? "500" : "400",
                color: active
                  ? activeTint
                  : onInk
                    ? "rgba(253,240,213,0.55)"
                    : colors.textTertiary,
              }}
            >
              {item}
            </Text>
            <View
              style={[
                styles.tabUnderline,
                { backgroundColor: active ? activeTint : "transparent" },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 12,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { position: "relative" },
  badge: {
    position: "absolute",
    top: -4,
    right: -5,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 8, fontWeight: "500", color: colors.cream },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.gutter,
    borderBottomWidth: borderWidth.hairline,
  },
  tab: { flex: 1, alignItems: "center", gap: 7, paddingTop: 4 },
  tabUnderline: { height: 2, width: "62%", borderRadius: 1 },
});
