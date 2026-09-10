import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

const secretKey = () => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not set");
  }
  return key;
};

/**
 * Paystack works in the smallest currency unit. GH 72.50 is 7250 pesewas.
 * Sending 72.5 would charge less than a cedi, so this conversion is not
 * optional - and it must produce a whole number.
 */
export const toPesewas = (cedis) => Math.round(cedis * 100);

export const toCedis = (pesewas) => Math.round(pesewas) / 100;

const request = async (path, options = {}) => {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.status === false) {
    const error = new Error(body.message || "Paystack request failed");
    error.status = response.status;
    throw error;
  }

  return body.data;
};

/**
 * Start a payment. Paystack returns a checkout URL the app opens; the customer
 * chooses Mobile Money, card or bank transfer on Paystack's own page, so no
 * card or MoMo details ever touch this server.
 */
export const initializeTransaction = async ({
  email,
  amountCedis,
  reference,
  metadata,
  callbackUrl,
}) =>
  request("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount: toPesewas(amountCedis),
      currency: "GHS",
      reference,
      metadata,
      channels: ["mobile_money", "card", "bank_transfer"],
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    }),
  });

/**
 * Ask Paystack what really happened. Never trust the client's word that a
 * payment succeeded - the client can lie, Paystack cannot.
 */
export const verifyTransaction = async (reference) =>
  request(`/transaction/verify/${encodeURIComponent(reference)}`);

/**
 * Prove a webhook actually came from Paystack.
 *
 * Paystack signs the exact raw request body with your secret key. So the
 * comparison must be against the untouched bytes - once express.json() has
 * parsed and re-serialised the body, the signature will never match again.
 *
 * timingSafeEqual rather than === so the comparison cannot be attacked by
 * measuring how long it takes to fail.
 */
export const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature || !rawBody) return false;

  const expected = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

export const initiateRefund = async ({ reference, amountCedis }) =>
  request("/refund", {
    method: "POST",
    body: JSON.stringify({
      transaction: reference,
      ...(amountCedis ? { amount: toPesewas(amountCedis) } : {}),
    }),
  });
