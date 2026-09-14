/**
 * Cloudinary image sizing.
 *
 * A product photo is stored once at up to 1200px. Every place that shows one
 * needs a different size, and asking for the full 1200px everywhere is what
 * turns a product list into a 40MB download on someone's data bundle.
 *
 * Cloudinary resizes from the URL itself, so the whole job is inserting a
 * transformation segment after `/upload/`:
 *
 *   https://res.cloudinary.com/x/image/upload/v1/shoptrace/a.jpg
 *   https://res.cloudinary.com/x/image/upload/w_300,q_auto,f_auto/v1/shoptrace/a.jpg
 *
 * `q_auto` lets Cloudinary pick the quality, and `f_auto` serves WebP to
 * phones that accept it and JPEG to those that do not - decided per request
 * from the Accept header, so it costs nothing here.
 */

/** Inserts a transformation into a Cloudinary URL. Anything else is returned unchanged. */
export const sized = (url: string | undefined, transform: string): string | undefined => {
  if (!url) return undefined;
  // A non-Cloudinary URL (a seeded placeholder, or a future S3 migration) has
  // no /upload/ marker, and must pass through rather than be corrupted.
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/${transform}/`);
};

/** 78px form thumbnail. Square crop, because the strip is a fixed grid. */
export const thumb = (url?: string) => sized(url, "w_200,h_200,c_fill,q_auto,f_auto");

/** Product card on the home and search screens. */
export const cardImage = (url?: string) => sized(url, "w_400,q_auto,f_auto");

/** The hero image on a product detail screen. */
export const heroImage = (url?: string) => sized(url, "w_800,q_auto,f_auto");

/** Shop logo, wherever it appears small. */
export const logoImage = (url?: string) => sized(url, "w_160,h_160,c_fill,q_auto,f_auto");

/* ------------------------------------------------ the representative photo */

/**
 * Which listing's photo represents a product that several shops sell.
 *
 * ShopTrace has no product catalogue - "iPhone 18 Plus" is not a row, it is
 * four separate Product documents that happen to share a name. So there is no
 * canonical image to fetch; one listing's photo has to stand in for the
 * product, and the choice has to be made somewhere.
 *
 * The rule has to be DETERMINISTIC above all. Picking "the first listing with
 * a photo" reads fine until you notice the array is in the server's sort
 * order: switch from Nearest to Cheapest and the product changes its picture.
 * The final tie-break on _id is what stops that - it is stable across every
 * sort, filter and refetch.
 *
 * Ranked, in order:
 *   1. has a photo at all          - nothing else matters without one
 *   2. Brand new over used         - a scratched unit should not be the face
 *                                    of the product a customer is browsing
 *   3. proven shops first          - fulfilmentRate, the trust signal we
 *                                    already compute; unproven (null) sits
 *                                    between good and bad rather than last,
 *                                    or a new shop could never be chosen
 *   4. more photos                 - a shop that uploaded five cared more
 *   5. _id                         - arbitrary, but the SAME arbitrary every
 *                                    time, which is the whole point
 *
 * This picks the face of the product for BROWSING. It is never used to
 * illustrate a particular shop's offer - see the detail screen, where each
 * offer shows its own photos.
 */
export type RepresentableListing = {
  _id: string;
  imageUrls?: string[];
  condition?: string;
  fulfilmentRate?: number | null;
};

export const pickRepresentative = <T extends RepresentableListing>(
  listings: T[],
): T | undefined => {
  const withPhotos = listings.filter((l) => l.imageUrls?.length);
  if (withPhotos.length === 0) return undefined;

  // 0.5 for an unproven shop: better than a shop that has let people down,
  // worse than one that has delivered. fulfilmentRate is null until a shop
  // has three outcomes.
  const trust = (l: RepresentableListing) =>
    l.fulfilmentRate === null || l.fulfilmentRate === undefined
      ? 0.5
      : l.fulfilmentRate;

  return [...withPhotos].sort((a, b) => {
    const aNew = a.condition === "Brand new" ? 0 : 1;
    const bNew = b.condition === "Brand new" ? 0 : 1;
    if (aNew !== bNew) return aNew - bNew;

    const trustGap = trust(b) - trust(a);
    if (Math.abs(trustGap) > 0.001) return trustGap;

    const countGap = (b.imageUrls?.length ?? 0) - (a.imageUrls?.length ?? 0);
    if (countGap !== 0) return countGap;

    return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
  })[0];
};
