/**
 * Screen 15 - Analytics. Real figures from GET /api/merchant/summary.
 *
 * Charts use INK and TAN only - hierarchy by tone, never by colour coding.
 *
 * One honest departure from the design spec: the sales funnel is three steps,
 * not five. Clicks and add-to-cart are not tracked anywhere on the server, and
 * a funnel with invented middle steps would be a chart that lies.
 */
import { useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { InkHeader } from "@/components/headers";
import { Card, Chip, EmptyState, ImageWell } from "@/components/ui";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { cedis } from "@/lib/format";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import type { MerchantSummary } from "@/lib/merchantTypes";

const PERIODS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "3 months", days: 90 },
  { label: "All time", days: 365 },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Analytics() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState(PERIODS[1]);

  const { data, loading, error, reload } = useAsync(
    () => api.get<MerchantSummary>(`/merchant/summary?days=${period.days}`),
    [period.days],
    { refetchOnFocus: true },
  );

  const stats = data?.stats;
  const byDay = data?.byDay ?? [];
  const revenuePeak = byDay.length ? Math.max(...byDay.map((d) => d.revenue)) : 0;

  // MongoDB's $dayOfWeek is 1 = Sunday, so index 0 here is Sunday.
  const byWeekday = WEEKDAYS.map((label, i) => ({
    label,
    value: byDay
      .filter((d) => d.weekday === i + 1)
      .reduce((sum, d) => sum + d.orders, 0),
  }));
  const weekdayPeak = Math.max(...byWeekday.map((d) => d.value), 0);

  const top = data?.topProducts ?? [];
  const topMax = top.length ? Math.max(...top.map((p) => p.revenue)) : 0;

  const funnel = data?.funnel ?? [];
  const funnelMax = funnel.length ? Math.max(...funnel.map((f) => f.value), 1) : 1;

  return (
    <View style={{ flex: 1 }}>
      <InkHeader>
        <View style={styles.topRow}>
          <Text style={styles.title}>Analytics</Text>
          <Pressable hitSlop={8} onPress={reload}>
            <Ionicons name="refresh-outline" size={20} color={colors.cream} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {PERIODS.map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              active={p.label === period.label}
              onSurface="ink"
              onPress={() => setPeriod(p)}
            />
          ))}
        </ScrollView>
      </InkHeader>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.ink} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !stats ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 32 }} />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title={error} action="Pull down to retry" />
        ) : (
          <>
            <View style={styles.statGrid}>
              <Stat label="Revenue" value={cedis(stats?.revenue ?? 0)} />
              <Stat label="Orders" value={String(stats?.orders ?? 0)} />
              <Stat label="Product views" value={String(stats?.views ?? 0)} />
              <Stat
                label="Conversion"
                value={`${stats?.conversionRate ?? 0}%`}
              />
            </View>

            <Card style={{ gap: 9 }}>
              <Text style={styles.cardTitle}>Still in progress</Text>
              <Text style={styles.hint}>
                {cedis(stats?.pipelineValue ?? 0)} across{" "}
                {(stats?.orders ?? 0) - (stats?.completed ?? 0)} orders not yet
                completed. Revenue above counts completed orders only.
              </Text>
            </Card>

            {byDay.length > 0 ? (
              <Card style={{ gap: 12 }}>
                <Text style={styles.cardTitle}>Revenue over {period.label}</Text>
                <View style={styles.chart}>
                  {byDay.slice(-14).map((d) => (
                    <View key={d.date} style={styles.barColumn}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: 8 + (revenuePeak ? (d.revenue / revenuePeak) * 62 : 0),
                            backgroundColor:
                              d.revenue === revenuePeak && revenuePeak > 0
                                ? colors.ink
                                : colors.border,
                          },
                        ]}
                      />
                      <Text style={styles.axisLabel}>{d.date.slice(5)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : (
              <Card>
                <Text style={styles.hint}>
                  No paid orders in this period yet.
                </Text>
              </Card>
            )}

            {weekdayPeak > 0 ? (
              <Card style={{ gap: 12 }}>
                <Text style={styles.cardTitle}>Orders by day</Text>
                <View style={styles.chart}>
                  {byWeekday.map((d) => (
                    <View key={d.label} style={styles.barColumn}>
                      <Text style={styles.barValue}>{d.value}</Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: 8 + (d.value / weekdayPeak) * 52,
                            backgroundColor:
                              d.value === weekdayPeak ? colors.ink : colors.border,
                          },
                        ]}
                      />
                      <Text style={styles.axisLabel}>{d.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {top.length > 0 ? (
              <Card style={{ gap: 13 }}>
                <Text style={styles.cardTitle}>Top products by revenue</Text>
                {top.map((p, i) => (
                  <View key={p.product} style={styles.topRowItem}>
                    <Text style={styles.rank}>{i + 1}</Text>
                    <ImageWell size={38} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.topName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.topMeta}>
                        {p.units} sold · {p.orders} orders
                      </Text>
                      <View style={styles.topTrack}>
                        <View
                          style={[
                            styles.topFill,
                            { width: `${topMax ? (p.revenue / topMax) * 100 : 0}%` },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.topRevenue}>{cedis(p.revenue)}</Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={{ gap: 11 }}>
              <Text style={styles.cardTitle}>From view to delivery</Text>
              {funnel.map((step) => (
                <View key={step.label} style={styles.funnelRow}>
                  <View style={styles.funnelTrack}>
                    <View
                      style={[
                        styles.funnelFill,
                        { width: `${(step.value / funnelMax) * 100}%` },
                      ]}
                    >
                      <Text style={styles.funnelLabel} numberOfLines={1}>
                        {step.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.funnelValue}>{step.value}</Text>
                </View>
              ))}
              <Text style={styles.hint}>
                How many people saw your products, how many ordered, and how
                many of those orders you completed.
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { flex: 1, ...type.pageTitle, color: colors.cream },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  statCard: {
    width: "48.6%",
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    padding: spacing.card,
    gap: 4,
  },
  statLabel: { fontSize: 10, color: colors.textTertiary },
  statValue: { fontSize: 20, fontWeight: "500", color: colors.textPrimary },
  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
  hint: { fontSize: 10, color: colors.textTertiary, lineHeight: 15 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 100,
  },
  barColumn: { flex: 1, alignItems: "center", gap: 5 },
  barValue: { fontSize: 9, color: colors.textTertiary },
  bar: { width: 14, borderRadius: 3 },
  axisLabel: { fontSize: 8, color: colors.textMuted },
  topRowItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  rank: { fontSize: 12, color: colors.textMuted, width: 12 },
  topName: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  topMeta: { fontSize: 10, color: colors.textTertiary },
  topTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
    maxWidth: 80,
  },
  topFill: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
  topRevenue: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  funnelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  funnelTrack: {
    flex: 1,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
  },
  funnelFill: {
    height: 26,
    backgroundColor: colors.ink,
    borderRadius: 6,
    justifyContent: "center",
    paddingHorizontal: 9,
    minWidth: 90,
  },
  funnelLabel: { fontSize: 10, fontWeight: "500", color: colors.cream },
  funnelValue: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textPrimary,
    width: 46,
    textAlign: "right",
  },
});
