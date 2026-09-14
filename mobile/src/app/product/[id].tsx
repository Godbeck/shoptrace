/**
 * Screen 5 - Product detail.
 *
 * The most important screen in the app, because the comparison is what
 * ShopTrace is for. Every shop selling this product is listed, cheapest first,
 * with its own stock, distance and buttons.
 *
 * This screen deliberately ignores the distance tiers used in search - a
 * cheaper shop further away must be visible here, since comparing is the whole
 * point of the page.
 */
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/headers";
import { CartButton } from "@/components/CartButton";
import { iconForCategory } from "@/components/cards";
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  ImageWell,
  InkPill,
  StatusPill,
  VerifiedBadge,
} from "@/components/ui";
import { borderWidth, colors, radius, spacing, type } from "@/theme";
import { cedis, distance } from "@/lib/format";
import { api, type ApiProduct, type ApiVariant } from "@/lib/api";
import { useAsync, useCoords } from "@/lib/useApi";
import { useSession } from "@/lib/session";
import { useCart } from "@/lib/cart";
import { useShop } from "@/lib/shop";
import { heroImage, pickRepresentative, thumb } from "@/lib/images";
import { variantLabel } from "@/lib/categories";
import {
  reliabilityLabel,
  stockLabel,
  trustNote,
  type StockConfidence,
} from "@/lib/stockTrust";

type Offer = {
  _id: string;
  price: number;
  stockCount: number;
  inStock: boolean;
  condition: string;
  imageUrls?: string[];
  variants?: ApiVariant[];
  isSelected: boolean;
  stockConfirmedAt?: string;
  stockConfidence?: StockConfidence;
  needsConfirmation?: boolean;
  fulfilmentRate?: number | null;
  shop: {
    _id: string;
    name: string;
    address: string;
    phone: string;
    deliveryRange: string;
    averageRating: number;
    fulfilledCount?: number;
    declinedCount?: number;
  };
  distanceMeters: number | null;
};

type Comparison = {
  name: string;
  brand?: string;
  count: number;
  lowest: number;
  highest: number;
  offers: Offer[];
};

type History = {
  history: { price: number; previousPrice?: number; createdAt: string }[];
};

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { latitude, longitude } = useCoords();
  const { signedIn, notify, notifyError } = useSession();
  const { add } = useCart();
  // A merchant browsing as a customer is the same account. They may buy from
  // anyone except themselves, so their own shop's offer gets an edit button
  // where the add button would be, rather than a rejection at checkout.
  const { shop: myShop } = useShop();

  const [target, setTarget] = useState("");
  const [savingAlert, setSavingAlert] = useState(false);
  const [addingFrom, setAddingFrom] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  // Hero images that failed to load, so a dead URL falls back to the category
  // icon instead of leaving a 260px hole where the product should be.
  const [brokenHero, setBrokenHero] = useState<string[]>([]);
  // Which variant is chosen, per offer. Each shop stocks its own colours and
  // sizes, so the choice cannot be a single value for the whole screen.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const { width } = useWindowDimensions();

  // Bringing the price-alert field above the keyboard.
  //
  // automaticallyAdjustKeyboardInsets makes room for the keyboard, but on a
  // long page it does not guarantee the field ends up somewhere you can see.
  // Remembering where the card is and scrolling to it on focus does.
  const scrollRef = useRef<ScrollView>(null);
  const alertY = useRef(0);

  const revealAlertField = () => {
    // A beat, so the keyboard has started animating and the inset is applied.
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(alertY.current - 90, 0),
        animated: true,
      });
    }, 120);
  };

  const { data, loading, error } = useAsync(
    () => api.get<ApiProduct>(`/products/${id}`),
    [id],
    { refetchOnFocus: true },
  );

  const comparison = useAsync(
    () =>
      api.get<Comparison>(
        `/products/${id}/compare?latitude=${latitude}&longitude=${longitude}`,
      ),
    [id, latitude, longitude],
    { refetchOnFocus: true },
  );

  const history = useAsync(
    () => api.get<History>(`/products/${id}/price-history`),
    [id],
  );

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Product Detail" right={<CartButton />} />
        <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Product Detail" right={<CartButton />} />
        <EmptyState
          icon="cloud-offline-outline"
          title={error ?? "Product not found"}
          action="Go back and try another product"
        />
      </View>
    );
  }

  const product = data;
  const offers = comparison.data?.offers ?? [];
  const lowest = comparison.data?.lowest ?? product.price;
  const highest = comparison.data?.highest ?? product.price;
  const spread = offers.length > 1 && highest > lowest;

  const addOffer = (offer: Offer) => {
    if (myShop && offer.shop._id === myShop._id) {
      notify({ title: "This is your own listing" });
      return;
    }
    if (!offer.inStock) {
      notify({ title: "That shop is out of stock" });
      return;
    }

    // A product that varies cannot be added "in general" - the merchant would
    // not know what to pack, and the server refuses it anyway.
    const variants = offer.variants ?? [];
    const variant = variants.length
      ? variants.find((v) => v._id === chosen[offer._id])
      : undefined;

    if (variants.length && !variant) {
      notify({ title: "Choose an option first" });
      return;
    }
    if (variant && variant.stockCount < 1) {
      notify({ title: "That option is sold out" });
      return;
    }
    setAddingFrom(offer._id);
    add(
      {
        productId: offer._id,
        variantId: variant?._id,
        variantLabel: variant ? variantLabel(variant) : undefined,
        name: product.name,
        // THIS shop's photo, not the hero - the cart must show what this
        // particular shop is selling, at this condition.
        imageUrl: offer.imageUrls?.[0],
        brand: product.brand,
        // A variant can set its own price - size 45 often costs more.
        price: variant?.price ?? offer.price,
        category: product.categories?.[0] ?? "Other",
        shopId: offer.shop._id,
        shopName: offer.shop.name,
        // The chosen shelf's stock, not the product total - the cart's "+"
        // must stop at what this option actually has.
        stockCount: variant ? variant.stockCount : offer.stockCount,
        stockConfidence: offer.stockConfidence,
        needsConfirmation: offer.needsConfirmation,
      },
      1,
    );
    notify({
      title: `Added from ${offer.shop.name}`,
      body: variant
        ? `${variantLabel(variant)} · ${cedis(variant.price ?? offer.price)} · ${variant.stockCount} in stock`
        : `${cedis(offer.price)} · ${offer.stockCount} in stock`,
      tone: "success",
    });
    setTimeout(() => setAddingFrom(null), 400);
  };

  const setAlert = async () => {
    if (!signedIn) {
      notify({
        title: "Create an account to set an alert",
        body: "We need somewhere to send it when the price drops.",
      });
      router.push("/auth/register");
      return;
    }

    const value = Number(target);
    if (!target.trim() || Number.isNaN(value) || value <= 0) {
      notify({ title: "Enter a target price above 0" });
      return;
    }
    setSavingAlert(true);
    try {
      await api.post("/price-alerts", { productId: id, targetPrice: value });
      setTarget("");
      notify({
        title: `Alert set at ${cedis(value)}`,
        body: "We will tell you when the price drops to it.",
        tone: "success",
      });
    } catch (e) {
      notifyError(e, "Could not set that alert");
    } finally {
      setSavingAlert(false);
    }
  };

  // The hero comes from ONE shop, chosen by the same ranked rule the browse
  // card used - so the photo you tapped is the photo you land on. Falling back
  // to this product's own images covers the case where the comparison has not
  // loaded, or where only this shop lists the item at all.
  const representative = pickRepresentative(offers);
  const heroImages = (
    representative?.imageUrls?.length
      ? representative.imageUrls
      : (product.imageUrls ?? [])
  ).filter((url) => !brokenHero.includes(url));
  const heroShopName =
    representative && representative.imageUrls?.length
      ? representative.shop.name
      : product.imageUrls?.length
        ? product.shopName
        : null;

  const points = (history.data?.history ?? []).slice(0, 7).reverse();
  const prices = points.map((h) => h.price);
  const hi = prices.length ? Math.max(...prices) : product.price;
  const lo = prices.length ? Math.min(...prices) : product.price;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Product Detail" right={<CartButton />} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, gap: 10 }}
        showsVerticalScrollIndicator={false}
        // The price-alert field sits well down this page. Without this the
        // keyboard slides over it and you cannot see what you are typing.
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {/* The gallery belongs to ONE shop - whichever pickRepresentative
            chose. Pooling every shop's photos would let you swipe between
            four different physical phones in four different conditions and
            think you were looking at one. */}
        {heroImages.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / width))
              }
            >
              {heroImages.map((url) => (
                <Image
                  key={url}
                  source={{ uri: heroImage(url) }}
                  style={{ width, height: 260 }}
                  resizeMode="cover"
                  onError={() =>
                    setBrokenHero((current) =>
                      current.includes(url) ? current : [...current, url],
                    )
                  }
                />
              ))}
            </ScrollView>

            {heroImages.length > 1 ? (
              <View style={styles.dots}>
                {heroImages.map((url, i) => (
                  <View
                    key={url}
                    style={[styles.dot, i === heroIndex && styles.dotOn]}
                  />
                ))}
              </View>
            ) : null}

            {heroShopName ? (
              // Whose photo this is. Without it the picture reads as the
              // product's own, and a customer buying the cheaper used one
              // from another shop would expect what they saw here.
              <View style={styles.heroCredit}>
                <Text style={styles.heroCreditText} numberOfLines={1}>
                  Photo from {heroShopName}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.imageArea}>
            <Ionicons
              name={iconForCategory(product.categories?.[0] ?? "Other")}
              size={64}
              color={colors.textMuted}
            />
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.gutter, gap: 10 }}>
          {/* The price row is the heart of the screen. */}
          <Card>
            <View style={styles.categoryRow}>
              {(product.categories ?? []).map((c) => (
                <View key={c} style={styles.categoryChip}>
                  <Text style={styles.categoryText}>{c}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.name}>{product.name}</Text>
            {product.brand ? (
              <Text style={styles.brand}>{product.brand}</Text>
            ) : null}

            <View style={styles.priceRow}>
              {spread ? <Text style={styles.from}>from</Text> : null}
              <Text style={styles.priceHero}>{cedis(lowest)}</Text>
              {spread ? (
                <Text style={styles.spread}>
                  — {cedis(highest)} across shops
                </Text>
              ) : null}
            </View>

            <Divider />

            <View style={styles.availability}>
              <Ionicons
                name="storefront-outline"
                size={15}
                color={colors.ink}
              />
              <Text style={styles.availabilityText}>
                {offers.length > 0 ? (
                  <>
                    Available at{" "}
                    <Text style={styles.availabilityStrong}>
                      {offers.length} {offers.length === 1 ? "shop" : "shops"}
                    </Text>{" "}
                    near you
                  </>
                ) : (
                  <>Sold by {product.shopName}</>
                )}
              </Text>
            </View>

            {product.description ? (
              <Text style={styles.description}>{product.description}</Text>
            ) : null}
          </Card>

          {/* ------------------------------- compare prices across shops */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionHead}>Compare prices across shops</Text>
            {spread ? (
              <InkPill label={`Save ${cedis(highest - lowest)}`} />
            ) : null}
          </View>

          {comparison.loading ? (
            <ActivityIndicator
              color={colors.ink}
              style={{ marginVertical: 16 }}
            />
          ) : offers.length === 0 ? (
            <Card>
              <Text style={styles.quiet}>
                Only this shop lists it right now. We will show a comparison as
                soon as another shop adds it.
              </Text>
            </Card>
          ) : (
            offers.map((offer, index) => {
              const best = index === 0 && offers.length > 1;
              // Once an option is chosen, every number on this card is about
              // THAT shelf. Showing the product total beside a sold-out size
              // is how a customer ends up at a 409 on the checkout screen.
              const picked = offer.variants?.find(
                (v) => v._id === chosen[offer._id],
              );
              const shownPrice = picked?.price ?? offer.price;
              const shownStock = picked ? picked.stockCount : offer.stockCount;
              const note = trustNote(offer);
              const reliability = reliabilityLabel(offer.fulfilmentRate);
              return (
                <View
                  key={offer._id}
                  style={[
                    styles.offerCard,
                    best && {
                      borderColor: colors.ink,
                      borderWidth: borderWidth.selected,
                    },
                  ]}
                >
                  {best ? (
                    <View style={styles.bestRow}>
                      <InkPill label="Best price" icon="trophy-outline" />
                    </View>
                  ) : null}

                  <View style={styles.offerTop}>
                    {/* The shop's OWN photo of their OWN unit. Never the
                        hero - condition is per listing, and a used phone
                        must not borrow the sealed-box picture. Shops with
                        no photo get the storefront icon, not someone
                        else's product. */}
                    <ImageWell
                      size={40}
                      uri={thumb(offer.imageUrls?.[0])}
                      icon="storefront-outline"
                    />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {offer.shop.name}
                      </Text>
                      <Text style={styles.shopMeta} numberOfLines={1}>
                        {offer.shop.address}
                        {offer.distanceMeters !== null
                          ? ` · ${distance(offer.distanceMeters)}`
                          : ""}
                      </Text>
                      <VerifiedBadge />
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 5 }}>
                      <Text style={styles.offerPrice}>
                        {cedis(shownPrice)}
                      </Text>
                      {/* Stock for the CHOSEN option, worded by how recently
                          the merchant vouched for it. A stale claim shows no
                          number at all. Showing the product total beside a
                          sold-out size is how a customer reaches a 409 at
                          checkout. */}
                      <StatusPill
                        {...stockLabel({ ...offer, stockCount: shownStock })}
                      />
                      {reliability ? <StatusPill {...reliability} /> : null}
                    </View>
                  </View>

                  {note ? (
                    <View style={styles.trustNote}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={13}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.trustText}>{note}</Text>
                    </View>
                  ) : null}

                  {offer.variants?.length ? (
                    <View style={{ gap: 7 }}>
                      <Text style={styles.optionLabel}>Choose an option</Text>
                      <View style={styles.optionWrap}>
                        {offer.variants.map((v) => {
                          const active = chosen[offer._id] === v._id;
                          const soldOut = v.stockCount < 1;
                          return (
                            <Pressable
                              key={v._id}
                              disabled={soldOut}
                              onPress={() =>
                                setChosen((c) => ({ ...c, [offer._id]: v._id }))
                              }
                              style={[
                                styles.option,
                                active && styles.optionActive,
                                soldOut && styles.optionOut,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.optionText,
                                  active && { color: colors.cream },
                                  soldOut && { color: colors.textMuted },
                                ]}
                              >
                                {variantLabel(v)}
                                {v.price != null && v.price !== offer.price
                                  ? ` · ${cedis(v.price)}`
                                  : ""}
                              </Text>
                              {/* Sold-out options stay visible rather than
                                  disappearing - "they have it, just not in my
                                  size" is useful, and a shrinking list looks
                                  like a bug. */}
                              {soldOut ? (
                                <Text style={styles.optionOutText}>Sold out</Text>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.offerActions}>
                    <Button
                      label="View shop"
                      variant="outline"
                      small
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/shop/${offer.shop._id}`)}
                    />
                    {myShop && offer.shop._id === myShop._id ? (
                      <Button
                        label="Edit listing"
                        variant="outline"
                        small
                        icon="create-outline"
                        style={{ flex: 1 }}
                        onPress={() =>
                          router.push(`/product-form?id=${offer._id}`)
                        }
                      />
                    ) : (
                      <Button
                        label={
                          addingFrom === offer._id
                            ? "Added"
                            : note
                              ? "Add anyway"
                              : "Add to cart"
                        }
                        small
                        icon="bag-add-outline"
                        style={{ flex: 1 }}
                        disabled={!offer.inStock}
                        onPress={() => addOffer(offer)}
                      />
                    )}
                  </View>
                </View>
              );
            })
          )}

          {/* ------------------------------------------------ price alert */}
          <Card
            style={{ gap: 11 }}
            onLayout={(e) => {
              alertY.current = e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.alertRow}>
              <View style={styles.alertWell}>
                <Ionicons
                  name="notifications-outline"
                  size={17}
                  color={colors.ink}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.alertTitle}>Set a price alert</Text>
                <Text style={styles.alertSub}>
                  Tell us your target and we will watch every shop for you
                </Text>
              </View>
            </View>
            <View style={styles.alertInputRow}>
              <Field
                prefix="GH₵"
                value={target}
                onChangeText={setTarget}
                keyboardType="decimal-pad"
                placeholder={String(Math.round(lowest * 0.85))}
                style={{ flex: 1 }}
                onFocus={revealAlertField}
                returnKeyType="done"
              />
              <Button
                label="Set alert"
                onPress={setAlert}
                loading={savingAlert}
              />
            </View>
          </Card>

          {/* ---------------------------------------------- price history */}
          {points.length > 1 ? (
            <Card style={{ gap: 12 }}>
              <Text style={styles.historyTitle}>Recent price changes</Text>
              <View style={styles.chart}>
                {points.map((point, i) => {
                  const isLatest = i === points.length - 1;
                  const range = Math.max(hi - lo, 1);
                  const h = 18 + ((point.price - lo) / range) * 52;
                  return (
                    <View key={point.createdAt} style={styles.barColumn}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: h,
                            backgroundColor: isLatest
                              ? colors.ink
                              : colors.border,
                          },
                        ]}
                      />
                      <Text style={styles.barLabel}>
                        {new Date(point.createdAt).toLocaleDateString("en-GH", {
                          day: "numeric",
                          month: "short",
                        })}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.historyFoot}>
                Low {cedis(lo)} · High {cedis(hi)}
              </Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ink,
    opacity: 0.25,
  },
  dotOn: { opacity: 0.85 },
  heroCredit: {
    position: "absolute",
    top: 10,
    left: spacing.gutter,
    maxWidth: "70%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  heroCreditText: { fontSize: 10, color: colors.textSecondary },
  imageArea: {
    height: 190,
    backgroundColor: colors.creamTint,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 9 },
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 9,
  },
  categoryText: { fontSize: 10, fontWeight: "500", color: colors.ink },
  name: { fontSize: 17, fontWeight: "500", color: colors.textPrimary },
  brand: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  from: { fontSize: 11, color: colors.textTertiary },
  priceHero: { ...type.priceHero, color: colors.textPrimary },
  spread: { fontSize: 11, color: colors.textMuted },
  availability: { flexDirection: "row", alignItems: "center", gap: 7 },
  availabilityText: { flex: 1, fontSize: 12, color: colors.textSecondary },
  availabilityStrong: { fontWeight: "500", color: colors.textPrimary },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 10,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 10,
  },
  sectionHead: { ...type.sectionHeader, color: colors.textPrimary },
  quiet: { fontSize: 12, color: colors.textTertiary, lineHeight: 17 },
  offerCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    padding: spacing.card,
    gap: 11,
  },
  optionLabel: { fontSize: 11, fontWeight: "500", color: colors.textSecondary },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
  },
  optionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionOut: { backgroundColor: colors.creamTint, borderColor: colors.border },
  optionText: { fontSize: 11.5, fontWeight: "500", color: colors.textPrimary },
  optionOutText: { fontSize: 8.5, color: colors.textMuted, marginTop: 1 },
  bestRow: { flexDirection: "row" },
  offerTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  shopName: { ...type.cardTitle, color: colors.textPrimary },
  shopMeta: { fontSize: 10, color: colors.textTertiary },
  offerPrice: { fontSize: 18, fontWeight: "500", color: colors.textPrimary },
  offerActions: { flexDirection: "row", gap: 9 },
  trustNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: colors.creamDeep,
    borderRadius: radius.button,
    padding: 10,
  },
  trustText: {
    flex: 1,
    fontSize: 10.5,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  alertWell: {
    width: 36,
    height: 36,
    borderRadius: radius.well,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { ...type.cardTitle, color: colors.textPrimary },
  alertSub: { fontSize: 10, color: colors.textTertiary, lineHeight: 14 },
  alertInputRow: { flexDirection: "row", gap: 9, alignItems: "flex-end" },
  historyTitle: { ...type.cardTitle, color: colors.textPrimary },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 88,
  },
  barColumn: { alignItems: "center", gap: 6, flex: 1 },
  bar: { width: 16, borderRadius: 3 },
  barLabel: { fontSize: 8, color: colors.textMuted },
  historyFoot: { fontSize: 10, color: colors.textTertiary },
});
