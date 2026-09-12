/**
 * Content and copy rules - design.md section 21.
 *
 * These live in one place because getting them wrong is the kind of thing
 * nobody notices in review but every user notices on screen.
 */

/**
 * `GH₵ 1,254.20` - symbol, space, thousands separators, and two decimals
 * ONLY when the amount actually has pesewas. A price of 890 renders as
 * "GH₵ 890", not "GH₵ 890.00".
 */
export const cedis = (amount: number): string => {
  const rounded = Math.round(amount * 100) / 100;
  const hasPesewas = rounded % 1 !== 0;

  const formatted = rounded.toLocaleString("en-GH", {
    minimumFractionDigits: hasPesewas ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return `GH₵ ${formatted}`;
};

/**
 * `0.8km` under 10km, `16km` above. Never metres in the interface - the spec
 * is explicit about that.
 */
export const distance = (metres: number): string => {
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
};

/**
 * Delivery timing is ALWAYS a range, never a fixed promise. A rider who takes
 * four days turns "48hrs" into the platform's reputation problem, and there is
 * no way to enforce it yet.
 *
 * The bands match the server's delivery tiers.
 */
export const deliveryEstimate = (metres: number): string => {
  if (metres <= 8000) return "Delivery today";
  if (metres <= 35000) return "Delivery in 1-2 days";
  return "Delivery in 2-4 days";
};

/** Which distance band an address falls in, for grouping search results. */
export const deliveryTier = (
  metres: number,
): "neighbourhood" | "city" | "regional" => {
  if (metres <= 8000) return "neighbourhood";
  if (metres <= 35000) return "city";
  return "regional";
};

/** "2 hours ago", "3 days ago" - for order timestamps and activity feeds. */
export const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;

  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
  });
};

/** The percentage pill on a price drop: -12%. */
export const dropPercent = (from: number, to: number): string => {
  if (from <= 0) return "";
  return `-${Math.round(((from - to) / from) * 100)}%`;
};

/** A Ghanaian phone number for display: 024 411 8820. */
export const phone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10) return raw;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
};
