/**
 * Screen 13 - Add / edit product. Real POST and PATCH against /api/products.
 *
 * Editing uses PATCH, which on the server goes through findById + .save() so
 * the price-history hooks fire. Change a price here and a PriceHistory record
 * is written automatically - visible on the customer product screen.
 *
 * Image upload is the one part still stubbed, because Cloudinary is not
 * connected. The tile says so rather than pretending to work.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { InkHeader } from "@/components/headers";
import { Button, Card, Divider, Field, Toggle } from "@/components/ui";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { api, type ApiProduct } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import { CATEGORIES } from "@/lib/categories";

// A product is exactly one category, unlike a shop.
const PRODUCT_CATEGORIES = CATEGORIES;
const CONDITIONS = ["Brand new", "Used", "Refurbished"];

export default function ProductForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { notify, notifyError } = useSession();

  const editing = Boolean(id);

  const existing = useAsync(
    async () => (id ? api.get<ApiProduct>(`/products/${id}`) : null),
    [id],
  );

  const [ready, setReady] = useState(!editing);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [condition, setCondition] = useState("Brand new");
  const [busy, setBusy] = useState(false);

  // Fill the form once, when the product arrives.
  if (editing && existing.data && !ready) {
    const p = existing.data;
    setName(p.name);
    setBrand(p.brand ?? "");
    setCategory(p.category);
    setDescription(p.description ?? "");
    setPrice(String(p.price));
    setStock(String(p.stockCount));
    setReady(true);
  }

  const submit = async () => {
    if (!name.trim() || !category || !price.trim()) {
      notify({ title: "Name, category and price are required" });
      return;
    }
    const priceValue = Number(price);
    const stockValue = Number(stock || 0);

    if (Number.isNaN(priceValue) || priceValue < 0) {
      notify({ title: "Price cannot be negative" });
      return;
    }
    if (!Number.isInteger(stockValue) || stockValue < 0) {
      notify({ title: "Stock must be a whole number of 0 or more" });
      return;
    }

    const body = {
      name: name.trim(),
      brand: brand.trim() || undefined,
      category,
      description: description.trim(),
      price: priceValue,
      stockCount: stockValue,
      condition,
    };

    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/products/${id}`, body);
        notify({ title: "Product updated", tone: "success" });
      } else {
        await api.post("/products", body);
        notify({ title: "Product published", tone: "success" });
      }
      router.back();
    } catch (error) {
      // A 403 here is the subscription limit, and it names the plan and count.
      notifyError(error, "Could not save the product");
    } finally {
      setBusy(false);
    }
  };

  if (editing && existing.loading && !ready) {
    return (
      <View style={{ flex: 1 }}>
        <InkHeader>
          <Text style={styles.title}>Edit product</Text>
        </InkHeader>
        <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <InkHeader>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.cream} />
          </Pressable>
          <Text style={styles.title}>
            {editing ? "Edit product" : "Add product"}
          </Text>
        </View>
      </InkHeader>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.gutter,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Images first - they matter most to a listing. */}
        <Card style={{ gap: 10 }}>
          <View style={styles.uploadZone}>
            <Ionicons name="camera-outline" size={26} color={colors.textTertiary} />
            <Text style={styles.uploadTitle}>Product photos</Text>
            <Text style={styles.uploadSub}>
              Photo uploads are coming soon
            </Text>
          </View>
        </Card>

        <Section title="Product details">
          <Field
            label="Product name"
            value={name}
            onChangeText={setName}
            placeholder="Infinix Hot 40i"
          />

          <View>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.wrapRow}>
              {PRODUCT_CATEGORIES.map((c) => {
                const selected = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[
                      styles.pill,
                      selected && {
                        backgroundColor: colors.ink,
                        borderColor: colors.ink,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: selected ? colors.cream : colors.textPrimary },
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label="Brand" value={brand} onChangeText={setBrand} placeholder="Infinix" />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What makes this worth buying?"
            multiline
            numberOfLines={4}
          />
        </Section>

        <Section title="Pricing and stock">
          <Field
            label="Price"
            prefix="GH₵"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="1450.50"
          />
          {editing ? (
            <Text style={styles.hint}>
              Changing the price writes a price-history record automatically, and
              fires any customer alerts watching this product.
            </Text>
          ) : null}
          <Field
            label="Stock quantity"
            value={stock}
            onChangeText={setStock}
            keyboardType="number-pad"
            placeholder="12"
          />

          <View>
            <Text style={styles.fieldLabel}>Condition</Text>
            <View style={styles.wrapRow}>
              {CONDITIONS.map((c) => {
                const selected = condition === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCondition(c)}
                    style={[
                      styles.pill,
                      selected && {
                        backgroundColor: colors.ink,
                        borderColor: colors.ink,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: selected ? colors.cream : colors.textPrimary },
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        <Card style={{ gap: 9 }}>
          <Text style={styles.cardTitle}>Visibility</Text>
          <Text style={styles.hint}>
            Stock decides availability. A product with 0 in stock shows to
            customers as out of stock automatically.
          </Text>
        </Card>

        <Button
          label={editing ? "Save changes" : "Publish product"}
          full
          loading={busy}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Card padded={false} style={{ overflow: "hidden" }}>
    <View style={styles.sectionStrip}>
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
    <View style={{ padding: spacing.card, gap: 12 }}>{children}</View>
  </Card>
);

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, ...type.pageTitle, color: colors.cream },
  uploadZone: {
    alignItems: "center",
    gap: 5,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  uploadTitle: { fontSize: 13, fontWeight: "500", color: colors.textPrimary },
  uploadSub: {
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 15,
  },
  sectionStrip: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.card,
    paddingVertical: 8,
  },
  sectionLabel: { fontSize: 11, fontWeight: "500", color: colors.ink },
  cardTitle: { ...type.cardTitle, color: colors.textPrimary },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: 7,
  },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  pillText: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  hint: { fontSize: 10, color: colors.textTertiary, lineHeight: 15 },
});
