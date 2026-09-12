/**
 * The component patterns from design.md section 6.
 *
 * Built once here so a product card on Home and a product card in Search are
 * literally the same object - same edges, same baselines, same inner padding.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  borderWidth,
  card,
  colors,
  radius,
  spacing,
  status,
  StatusTone,
  type,
} from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/* ------------------------------------------------------------------ Card */

export const Card = ({
  children,
  style,
  padded = true,
  onLayout,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  /** Forwarded so a screen can find out where a card sits, e.g. to scroll to it. */
  onLayout?: ViewProps["onLayout"];
}) => (
  <View
    style={[card, padded && { padding: spacing.card }, style]}
    onLayout={onLayout}
  >
    {children}
  </View>
);

/* ---------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "outline" | "danger" | "cream";

export const Button = ({
  label,
  onPress,
  variant = "primary",
  icon,
  full = false,
  small = false,
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  full?: boolean;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) => {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.ink, fg: colors.cream, border: colors.ink },
    outline: { bg: colors.white, fg: colors.ink, border: colors.border },
    danger: { bg: status.danger.bg, fg: status.danger.fg, border: status.danger.bg },
    cream: { bg: colors.cream, fg: colors.ink, border: colors.cream },
  };
  const c = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          // Full-width primary buttons use the wider 12px radius.
          borderRadius: full ? radius.buttonWide : radius.button,
          paddingVertical: small ? 8 : 13,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        full && { alignSelf: "stretch" },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.fg} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={small ? 13 : 15} color={c.fg} />
          ) : null}
          <Text
            style={[
              small ? type.buttonSmall : type.button,
              { color: c.fg },
            ] as TextStyle[]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
};

/* ------------------------------------------------------------ StatusPill */

export const StatusPill = ({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) => (
  <View style={[styles.pill, { backgroundColor: status[tone].bg }]}>
    <Text style={[styles.pillText, { color: status[tone].fg }]}>{label}</Text>
  </View>
);

/** An ink-filled pill - "Featured", "-12%", "Best price". */
export const InkPill = ({
  label,
  icon,
}: {
  label: string;
  icon?: IconName;
}) => (
  <View style={[styles.pill, styles.inkPill]}>
    {icon ? <Ionicons name={icon} size={10} color={colors.cream} /> : null}
    <Text style={[styles.pillText, { color: colors.cream }]}>{label}</Text>
  </View>
);

/* ----------------------------------------------------------------- Chip */

export const Chip = ({
  label,
  active = false,
  onPress,
  removable = false,
  onSurface = "cream",
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  removable?: boolean;
  /** Chips sit on cream bodies and on ink merchant headers - both supported. */
  onSurface?: "cream" | "ink";
}) => {
  const activeBg = onSurface === "ink" ? colors.cream : colors.ink;
  const activeFg = onSurface === "ink" ? colors.ink : colors.cream;
  const idleBg = onSurface === "ink" ? "rgba(255,255,255,0.10)" : colors.white;
  const idleFg = onSurface === "ink" ? colors.cream : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? activeBg : idleBg,
          borderColor: active
            ? activeBg
            : onSurface === "ink"
              ? "rgba(255,255,255,0.18)"
              : colors.border,
        },
      ]}
    >
      <Text
        style={[styles.chipText, { color: active ? activeFg : idleFg }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {removable && active ? (
        <Ionicons name="close" size={11} color={activeFg} />
      ) : null}
    </Pressable>
  );
};

/* -------------------------------------------------------- VerifiedBadge */

/**
 * A check-circle in ink plus the word "Verified". Never a blue checkmark -
 * that reads as a social network, not a marketplace.
 */
export const VerifiedBadge = () => (
  <View style={styles.verified}>
    <Ionicons name="checkmark-circle" size={11} color={colors.ink} />
    <Text style={styles.verifiedText}>Verified</Text>
  </View>
);

/* ------------------------------------------------------------ ImageWell */

/**
 * Product and shop images are not wired up yet, so every image position is a
 * cream-tint well with a muted icon. Swapping these for real <Image> tags is
 * a single change per usage once Cloudinary is connected.
 */
export const ImageWell = ({
  size,
  icon = "cube-outline",
  style,
  radius: r = radius.well,
  children,
}: {
  size?: number;
  icon?: IconName;
  style?: ViewStyle;
  radius?: number;
  children?: React.ReactNode;
}) => (
  <View
    style={[
      styles.well,
      { borderRadius: r },
      size ? { width: size, height: size } : null,
      style,
    ]}
  >
    <Ionicons
      name={icon}
      size={size ? Math.max(14, size * 0.42) : 30}
      color={colors.textMuted}
    />
    {children}
  </View>
);

/* ---------------------------------------------------------------- Field */

export const Field = ({
  label,
  icon,
  rightIcon,
  onRightIconPress,
  prefix,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  icon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  prefix?: string;
  style?: ViewStyle;
}) => (
  <View style={style}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <View style={styles.fieldBox}>
      {icon ? (
        <Ionicons name={icon} size={16} color={colors.textTertiary} />
      ) : null}
      {prefix ? (
        <View style={styles.prefix}>
          <Text style={styles.prefixText}>{prefix}</Text>
        </View>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={styles.fieldInput}
        {...props}
      />
      {rightIcon ? (
        <Pressable onPress={onRightIconPress} hitSlop={8}>
          <Ionicons name={rightIcon} size={16} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  </View>
);

/* --------------------------------------------------------------- Toggle */

/** 38x22. On: ink track, cream knob right. Off: border track, white knob left. */
export const Toggle = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange?: (next: boolean) => void;
}) => (
  <Pressable
    onPress={() => onChange?.(!value)}
    style={[
      styles.toggleTrack,
      { backgroundColor: value ? colors.ink : colors.border },
    ]}
  >
    <View
      style={[
        styles.toggleKnob,
        {
          backgroundColor: value ? colors.cream : colors.white,
          alignSelf: value ? "flex-end" : "flex-start",
        },
      ]}
    />
  </Pressable>
);

/* ----------------------------------------------------------- SectionHead */

export const SectionHead = ({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) => (
  <View style={[styles.sectionHead, style]}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {actionLabel ? (
      <Pressable onPress={onAction} hitSlop={8}>
        <Text style={styles.sectionAction}>{actionLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

/* ------------------------------------------------------------ EmptyState */

/**
 * Empty screens are an invitation to act, so the supporting line names the
 * action rather than describing the emptiness.
 */
export const EmptyState = ({
  icon,
  title,
  action,
}: {
  icon: IconName;
  title: string;
  action: string;
}) => (
  <View style={styles.empty}>
    <Ionicons name={icon} size={34} color={colors.border} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyAction}>{action}</Text>
  </View>
);

/* -------------------------------------------------------------- Divider */

export const Divider = ({ style }: { style?: ViewStyle }) => (
  <View style={[styles.divider, style]} />
);

/* --------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    borderWidth: borderWidth.hairline,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
    alignSelf: "flex-start",
  },
  inkPill: { backgroundColor: colors.ink },
  pillText: { fontSize: 10, fontWeight: "500" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderWidth: borderWidth.hairline,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  verified: { flexDirection: "row", alignItems: "center", gap: 3 },
  verifiedText: { fontSize: 10, fontWeight: "500", color: colors.ink },
  well: {
    backgroundColor: colors.creamTint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fieldLabel: {
    ...type.fieldLabel,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  fieldInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  prefix: {
    borderRightWidth: borderWidth.hairline,
    borderRightColor: colors.border,
    paddingRight: 8,
  },
  prefixText: { fontSize: 13, color: colors.textSecondary },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: "center",
  },
  toggleKnob: { width: 18, height: 18, borderRadius: 9 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.gutter,
    marginBottom: 10,
  },
  sectionTitle: { ...type.sectionHeader, color: colors.textPrimary },
  sectionAction: { fontSize: 12, fontWeight: "500", color: colors.ink },
  empty: { alignItems: "center", paddingVertical: 48, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  emptyAction: { fontSize: 12, color: colors.textTertiary },
  divider: {
    height: borderWidth.hairline,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
  },
});
