/**
 * The ShopTrace design system, straight from design.md.
 *
 * Every colour, size and radius in the app comes from here. No screen should
 * ever write a hex value inline - if a value is missing, add it here first.
 * That is what keeps the identity from drifting one screen at a time.
 */

export const colors = {
  // Section 2 - palette
  cream: "#FDF0D5", // headers, key surfaces, text on dark
  creamDeep: "#FAF5EC", // page background behind cards
  creamTint: "#FDF6E8", // image wells, avatar and icon wells
  ink: "#1A1A1A", // primary text, buttons, merchant/admin headers
  white: "#FFFFFF", // card surfaces

  // Borders are ALWAYS one of these two warm tans. Never grey - see design.md
  // section 2, "critical rule on borders".
  border: "#E8DFC8",
  borderLight: "#F0E8D8", // dividers inside cards

  // Text
  textPrimary: "#1A1A1A",
  textSecondary: "#555555",
  textTertiary: "#999999",
  textMuted: "#BBBBBB",
} as const;

/**
 * Status colours live ONLY inside pills and inline alerts - never as a
 * surface, never as a card background. design.md section 22.
 */
export const status = {
  success: { bg: "#E8F5E9", fg: "#2E7D32" },
  warning: { bg: "#FDF0D5", fg: "#8B6914" },
  info: { bg: "#E3F2FD", fg: "#1565C0" },
  danger: { bg: "#FEECEC", fg: "#C62828" },
} as const;

export type StatusTone = keyof typeof status;

/**
 * Type scale from section 4. Maximum weight anywhere is 500 - there is
 * deliberately no 600 or 700 in this object, so it cannot be reached for.
 */
export const type = {
  pageTitle: { fontSize: 18, fontWeight: "500" },
  sectionHeader: { fontSize: 15, fontWeight: "500" },
  cardTitle: { fontSize: 13, fontWeight: "500" },
  body: { fontSize: 13, fontWeight: "400" },
  priceHero: { fontSize: 22, fontWeight: "500" },
  priceCard: { fontSize: 14, fontWeight: "500" },
  meta: { fontSize: 11, fontWeight: "400" },
  metaSmall: { fontSize: 10, fontWeight: "400" },
  button: { fontSize: 14, fontWeight: "500" },
  buttonSmall: { fontSize: 12, fontWeight: "500" },
  fieldLabel: { fontSize: 11, fontWeight: "500" },
  statValue: { fontSize: 22, fontWeight: "500" },
} as const;

/** Section 5 - shape and spacing. */
export const radius = {
  card: 12,
  panel: 14,
  button: 8,
  buttonWide: 12,
  input: 10,
  pill: 20,
  well: 10,
} as const;

export const spacing = {
  screen: 20, // header horizontal padding
  // Body gutter. Wider than the 14px in the spec because on a real phone the
  // cards read as tight to the edge at that value.
  gutter: 18,
  card: 14, // card internal padding
  stack: 8, // gap between stacked cards
  row: 10, // gap in horizontal scroll rows
} as const;

/**
 * 0.5px borders. On Android a 0.5 value can round to 0 and vanish, so this
 * uses StyleSheet.hairlineWidth, which is the real device-appropriate
 * equivalent and is what the 0.5px in the spec actually means.
 */
import { StyleSheet } from "react-native";

export const borderWidth = {
  hairline: StyleSheet.hairlineWidth,
  selected: 1.5, // section 5 - selected state is a 1.5px ink border
} as const;

/**
 * No shadows anywhere - section 5 is firm about this. Separation comes from
 * the hairline tan border against cream. Exported as a named constant so the
 * rule is visible in the code rather than just absent from it.
 */
export const NO_SHADOW = {
  shadowColor: "transparent",
  shadowOpacity: 0,
  elevation: 0,
} as const;

/** The standard white card: hairline tan border, 12px radius, no shadow. */
export const card = {
  backgroundColor: colors.white,
  borderRadius: radius.card,
  borderWidth: borderWidth.hairline,
  borderColor: colors.border,
  ...NO_SHADOW,
} as const;
