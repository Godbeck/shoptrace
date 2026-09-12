/**
 * How stock is described to a customer, and when to stop quoting a number.
 *
 * The rule behind all of this: a stock figure is a merchant's CLAIM, and a
 * claim has an age. A shop that also sells over the counter will forget to
 * update here - so rather than repeating a number the app cannot stand
 * behind, confidence decays and the wording softens with it.
 */
import { status, type StatusTone } from "@/theme";

export type StockConfidence = "fresh" | "aging" | "stale";

export type StockClaim = {
  stockCount: number;
  inStock: boolean;
  stockConfidence?: StockConfidence;
  needsConfirmation?: boolean;
  fulfilmentRate?: number | null;
};

/**
 * The label and tone for a stock claim.
 *
 * Note what happens at "stale": the number disappears entirely. Saying
 * "5 in stock" from a three-week-old claim is worse than saying nothing,
 * because it reads as a promise.
 */
export const stockLabel = (
  claim: StockClaim,
): { label: string; tone: StatusTone } => {
  if (!claim.inStock || claim.stockCount <= 0) {
    return { label: "Out of stock", tone: "danger" };
  }

  const confidence = claim.stockConfidence ?? "fresh";

  if (confidence === "stale") {
    // No figure at all - only an instruction.
    return { label: "Check availability", tone: "warning" };
  }

  if (confidence === "aging") {
    return {
      label:
        claim.stockCount <= 5
          ? `About ${claim.stockCount} left`
          : "Usually in stock",
      tone: "info",
    };
  }

  return {
    label:
      claim.stockCount <= 5
        ? `Only ${claim.stockCount} left`
        : `${claim.stockCount} in stock`,
    tone: claim.stockCount <= 5 ? "warning" : "success",
  };
};

/** One line explaining why the app is hedging, shown only when it is. */
export const trustNote = (claim: StockClaim): string | null => {
  if (!claim.needsConfirmation) return null;

  if (claim.fulfilmentRate !== null && claim.fulfilmentRate !== undefined && claim.fulfilmentRate < 70) {
    return `This shop has recently been unable to fulfil ${100 - claim.fulfilmentRate}% of its orders. Call ahead before paying.`;
  }

  return "This shop has not updated its stock in a while. Worth calling to check before you pay.";
};

/** How to describe a shop's track record, when it has one. */
export const reliabilityLabel = (
  rate: number | null | undefined,
): { label: string; tone: StatusTone } | null => {
  if (rate === null || rate === undefined) return null;
  if (rate >= 95) return { label: `${rate}% fulfilled`, tone: "success" };
  if (rate >= 80) return { label: `${rate}% fulfilled`, tone: "info" };
  return { label: `${rate}% fulfilled`, tone: "warning" };
};

export const CONFIDENCE_COPY: Record<StockConfidence, string> = {
  fresh: "Updated in the last day",
  aging: "Updated in the last week",
  stale: "Not updated in over a week",
};

export const confidenceTone = (c: StockConfidence): StatusTone =>
  c === "fresh" ? "success" : c === "aging" ? "info" : "warning";
