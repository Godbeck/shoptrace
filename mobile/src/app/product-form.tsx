/**
 * Screen 13 - Add / edit product. Real POST and PATCH against /api/products.
 *
 * Editing uses PATCH, which on the server goes through findById + .save() so
 * the price-history hooks fire. Change a price here and a PriceHistory record
 * is written automatically - visible on the customer product screen.
 *
 * Images upload to Cloudinary BEFORE the product is saved, because a new
 * product has no id yet to attach them to. The upload returns URLs, which then
 * ride along in the same body as the rest of the form.
 *
 * The consequence: abandoning the form after picking a photo leaves the file
 * on Cloudinary with nothing pointing at it. Sweeping orphans is a job for the
 * background worker, not for this screen.
 */
import { useRef, useState } from "react";
import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { InkHeader } from "@/components/headers";
import { Button, Card, Divider, Field, Toggle } from "@/components/ui";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { api, uploadImages, type ApiProduct } from "@/lib/api";
import { useAsync } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import {
  CATEGORIES,
  COLOR_SUGGESTIONS,
  variantLabel,
  variantsForCategories,
} from "@/lib/categories";
import { thumb } from "@/lib/images";

// A product is exactly one category, unlike a shop.
const PRODUCT_CATEGORIES = CATEGORIES;
const CONDITIONS = ["Brand new", "Used", "Refurbished"];

/** A variant while it is being edited - numbers are strings in a text field. */
type FormVariant = {
  _id?: string;
  color: string;
  size: string;
  stockCount: string;
  price: string;
};

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

  /**
   * Which product id has been loaded into the fields.
   *
   * This was a boolean seeded with `useState(!editing)`, and that was the bug:
   * useState only ever uses its initial value on the FIRST render, and
   * useLocalSearchParams returns {} on that render while the params resolve.
   * So `editing` was false, `ready` latched to true, and the fill below could
   * never run - every edit opened a blank form.
   *
   * A ref holding the id is immune to that, and also handles editing one
   * product then another without a remount.
   */
  const loadedId = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categories, setCategories] = useState<string[]>(["Electronics"]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [condition, setCondition] = useState("Brand new");
  const [busy, setBusy] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  // A draft row lives outside the saved list so a half-typed option cannot be
  // submitted by accident.
  const [variants, setVariants] = useState<FormVariant[]>([]);
  const [draftColor, setDraftColor] = useState("");
  const [draftSize, setDraftSize] = useState("");
  const [draftStock, setDraftStock] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [uploading, setUploading] = useState(false);
  // The UNION of every chosen category's axes. A jacket in Fashion AND Sports
  // & Outdoors still offers sizes; taking the intersection would strip the
  // axis the moment a merchant described their product more fully.
  const spec = variantsForCategories(categories);

  // Fill the fields once per product, as soon as it arrives.
  if (id && existing.data && loadedId.current !== id) {
    const p = existing.data;
    setName(p.name);
    setBrand(p.brand ?? "");
    setCategories(p.categories ?? []);
    setDescription(p.description ?? "");
    setPrice(String(p.price));
    setStock(String(p.stockCount));
    setImageUrls(p.imageUrls ?? []);
    setVariants(
      (p.variants ?? []).map((v) => ({
        // The id is preserved so saving EDITS the existing row. Dropping it
        // would create a new variant and orphan the old id, which is sitting
        // on live carts and on every order that ever bought it.
        _id: v._id,
        color: v.color ?? "",
        size: v.size ?? "",
        stockCount: String(v.stockCount ?? 0),
        price: v.price != null ? String(v.price) : "",
      })),
    );
    loadedId.current = id;
  }

  const MAX_IMAGES = 5;

  /** The draft row as a variant, or null when nothing has been typed into it. */
  const draftAsVariant = (): FormVariant | null => {
    const color = spec.color ? draftColor.trim() : "";
    const size = spec.size ? draftSize.trim() : "";
    if (!color && !size) return null;
    return {
      color,
      size,
      stockCount: draftStock.trim() || "0",
      price: draftPrice.trim(),
    };
  };

  const addVariant = () => {
    const draft = draftAsVariant();
    if (!draft) {
      notify({ title: "Give the option a colour or a size" });
      return;
    }
    const { color, size } = draft;
    const already = variants.some(
      (v) =>
        v.color.toLowerCase() === color.toLowerCase() &&
        v.size.toLowerCase() === size.toLowerCase(),
    );
    if (already) {
      notify({ title: `${variantLabel({ color, size })} is already listed` });
      return;
    }

    setVariants((current) => [...current, draft]);
    setDraftColor("");
    setDraftSize("");
    setDraftStock("");
    setDraftPrice("");
  };

  const setVariantStock = (index: number, value: string) =>
    setVariants((current) =>
      current.map((v, i) => (i === index ? { ...v, stockCount: value } : v)),
    );

  const removeVariant = (index: number) =>
    setVariants((current) => current.filter((_, i) => i !== index));

  // With options, the product's stock is their sum - the server derives it the
  // same way, so the merchant sees the number that will actually be stored.
  const variantTotal = variants.reduce(
    (total, v) => total + (Number(v.stockCount) || 0),
    0,
  );

  const pickImages = async () => {
    // Asked only when the button is pressed, not on mount: a merchant who
    // never adds a photo is never asked for their library.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify({
        title: "Photo access is off",
        body: "Enable photo access in Settings to add product images.",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - imageUrls.length,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    try {
      const { images } = await uploadImages(
        "/uploads/products",
        result.assets.map((asset, i) => ({
          uri: asset.uri,
          // multer treats a part with no filename as a plain text field, so
          // a name is required even though the server ignores it.
          name: asset.fileName ?? `photo-${Date.now()}-${i}.jpg`,
          type: asset.mimeType ?? "image/jpeg",
        })),
      );
      setImageUrls((current) => [...current, ...images.map((i) => i.url)]);
      notify({
        title: `${images.length} photo${images.length === 1 ? "" : "s"} uploaded`,
        tone: "success",
      });
    } catch (error) {
      notifyError(error, "Could not upload the photos");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) =>
    setImageUrls((current) => current.filter((u) => u !== url));

  const submit = async () => {
    if (!name.trim() || categories.length === 0 || !price.trim()) {
      notify({ title: "Name, at least one category, and price are required" });
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

    // A row typed into the draft fields but never added with the button is
    // still something the merchant meant. Silently dropping it is how "I added
    // Black, 10" turned into a product with no options at all - so it is
    // committed here rather than thrown away at the moment of saving.
    const draft = draftAsVariant();
    const allVariants =
      draft &&
      !variants.some(
        (v) =>
          v.color.toLowerCase() === draft.color.toLowerCase() &&
          v.size.toLowerCase() === draft.size.toLowerCase(),
      )
        ? [...variants, draft]
        : variants;

    const body = {
      name: name.trim(),
      brand: brand.trim() || undefined,
      categories,
      description: description.trim(),
      price: priceValue,
      stockCount: stockValue,
      condition,
      imageUrls,
      variants: allVariants.map((v) => ({
        ...(v._id ? { _id: v._id } : {}),
        color: v.color,
        size: v.size,
        stockCount: Number(v.stockCount) || 0,
        // Empty string means "no variant price", NOT free. The server treats
        // an absent price as "use the product price".
        ...(v.price.trim() ? { price: Number(v.price) } : {}),
      })),
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

  if (id && existing.loading && loadedId.current !== id) {
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
          {imageUrls.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {imageUrls.map((url, index) => (
                <View key={url} style={styles.thumbWrap}>
                  <Image
                    // w_200 is all a 78px thumbnail needs. Asking Cloudinary
                    // for the full 1200px here would cost the merchant data
                    // to look at their own photo.
                    source={{ uri: thumb(url) }}
                    style={styles.thumb}
                  />
                  {index === 0 ? (
                    <View style={styles.coverTag}>
                      <Text style={styles.coverText}>Cover</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.thumbRemove}
                    onPress={() => removeImage(url)}
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={12} color={colors.cream} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <Pressable
            onPress={pickImages}
            disabled={uploading || imageUrls.length >= MAX_IMAGES}
            style={styles.uploadZone}
          >
            {uploading ? (
              <>
                <ActivityIndicator color={colors.ink} />
                <Text style={styles.uploadSub}>Uploading...</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="camera-outline"
                  size={26}
                  color={colors.textTertiary}
                />
                <Text style={styles.uploadTitle}>
                  {imageUrls.length === 0
                    ? "Add product photos"
                    : "Add another"}
                </Text>
                <Text style={styles.uploadSub}>
                  {imageUrls.length >= MAX_IMAGES
                    ? `${MAX_IMAGES} photos is the maximum`
                    : `${imageUrls.length} of ${MAX_IMAGES} · the first one is the cover`}
                </Text>
              </>
            )}
          </Pressable>
        </Card>

        <Section title="Product Details">
          <Field
            label="Product name"
            value={name}
            onChangeText={setName}
            placeholder="Infinix Hot 40i"
          />

          <View>
            <Text style={styles.fieldLabel}>
              Categories{categories.length > 1 ? ` · ${categories.length}` : ""}
            </Text>
            <Text style={[styles.hint, { marginBottom: 7 }]}>
              Pick every one it belongs in. Running shoes are genuinely Shoes
              and Sports &amp; Outdoors, and listing both means it turns up in
              both searches.
            </Text>
            <View style={styles.wrapRow}>
              {PRODUCT_CATEGORIES.map((c) => {
                const selected = categories.includes(c);
                return (
                  <Pressable
                    key={c}
                    onPress={() =>
                      setCategories((current) =>
                        current.includes(c)
                          ? // Never empty. Deselecting the last one would leave
                            // a product the API refuses to save, discovered only
                            // at the bottom of the form.
                            current.length === 1
                            ? current
                            : current.filter((x) => x !== c)
                          : [...current, c],
                      )
                    }
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

          <Field
            label="Brand"
            value={brand}
            onChangeText={setBrand}
            placeholder="Infinix"
          />
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
              Changing the price writes a price-history record automatically,
              and fires any customer alerts watching this product.
            </Text>
          ) : null}
          {variants.length === 0 ? (
            <Field
              label="Stock quantity"
              value={stock}
              onChangeText={setStock}
              keyboardType="number-pad"
              placeholder="12"
            />
          ) : (
            // Hidden rather than disabled once options exist. A greyed-out
            // field still reads as a number the merchant should care about,
            // and this one is now derived from the rows below.
            <View style={styles.derivedTotal}>
              <Text style={styles.derivedLabel}>Total stock</Text>
              <Text style={styles.derivedValue}>
                {variantTotal} across {variants.length}{" "}
                {variants.length === 1 ? "option" : "options"}
              </Text>
            </View>
          )}

          {spec.color || spec.size ? (
            <>
              <Divider />
              <View style={{ gap: 4 }}>
                <Text style={styles.fieldLabel}>
                  Colours and {spec.size ? spec.size.label.toLowerCase() : "options"}
                </Text>
                <Text style={styles.hint}>
                  Optional. Add one row per combination you actually stock, with
                  its own count — a customer buying {spec.size ? spec.size.label.toLowerCase() : "an option"} sees that
                  number, not the total.
                </Text>
              </View>

              {variants.map((v, index) => (
                <View key={`${v.color}|${v.size}`} style={styles.variantRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.variantName}>{variantLabel(v)}</Text>
                    {v.price.trim() ? (
                      <Text style={styles.variantPrice}>GH₵ {v.price}</Text>
                    ) : null}
                  </View>
                  <TextInput
                    value={v.stockCount}
                    onChangeText={(t: string) => setVariantStock(index, t)}
                    keyboardType="number-pad"
                    style={styles.variantStock}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Pressable onPress={() => removeVariant(index)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ))}

              {/* The draft row. Suggestions are chips, but the field stays
                  typeable — no fixed list survives a real market. */}
              <View style={styles.draftBox}>
                {spec.color ? (
                  <>
                    <Field
                      label="Colour"
                      value={draftColor}
                      onChangeText={setDraftColor}
                      placeholder="Blue"
                    />
                    <View style={styles.wrapRow}>
                      {COLOR_SUGGESTIONS.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => setDraftColor(c)}
                          style={[styles.suggest, draftColor === c && styles.suggestOn]}
                        >
                          <Text
                            style={[
                              styles.suggestText,
                              draftColor === c && { color: colors.cream },
                            ]}
                          >
                            {c}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}

                {spec.size ? (
                  <>
                    <Field
                      label={spec.size.label}
                      value={draftSize}
                      onChangeText={setDraftSize}
                      placeholder={spec.size.suggestions[0] ?? "One size"}
                    />
                    <View style={styles.wrapRow}>
                      {spec.size.suggestions.map((o: string) => (
                        <Pressable
                          key={o}
                          onPress={() => setDraftSize(o)}
                          style={[styles.suggest, draftSize === o && styles.suggestOn]}
                        >
                          <Text
                            style={[
                              styles.suggestText,
                              draftSize === o && { color: colors.cream },
                            ]}
                          >
                            {o}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}

                <View style={{ flexDirection: "row", gap: 9 }}>
                  <Field
                    label="How many"
                    value={draftStock}
                    onChangeText={setDraftStock}
                    keyboardType="number-pad"
                    placeholder="10"
                    style={{ flex: 1 }}
                  />
                  <Field
                    label="Price (optional)"
                    prefix="GH₵"
                    value={draftPrice}
                    onChangeText={setDraftPrice}
                    keyboardType="decimal-pad"
                    placeholder={price || "same"}
                    style={{ flex: 1 }}
                  />
                </View>

                <Button
                  label="Add option"
                  variant="outline"
                  small
                  icon="add"
                  onPress={addVariant}
                />
              </View>
            </>
          ) : null}

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
  derivedTotal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.creamTint,
    borderRadius: radius.button,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  derivedLabel: { fontSize: 11, color: colors.textSecondary },
  derivedValue: { fontSize: 12, fontWeight: "500", color: colors.textPrimary },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  variantName: { fontSize: 12.5, fontWeight: "500", color: colors.textPrimary },
  variantPrice: { fontSize: 10, color: colors.textTertiary },
  variantStock: {
    width: 52,
    textAlign: "center",
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: 6,
  },
  draftBox: {
    gap: 9,
    backgroundColor: colors.creamTint,
    borderRadius: radius.card,
    padding: 11,
  },
  suggest: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  suggestOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  suggestText: { fontSize: 11, color: colors.textPrimary },
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
  thumbWrap: { width: 78, height: 78 },
  thumb: {
    width: 78,
    height: 78,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
  },
  thumbRemove: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  coverTag: {
    position: "absolute",
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.ink,
  },
  coverText: { fontSize: 9, color: colors.cream },
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
