import { Queue } from "bullmq";
import IORedis from "ioredis";

export const QUEUE_NAME = "shoptrace";

/** Job names. Kept in one place so the producer and the worker cannot drift. */
export const JOBS = {
  EXPIRE_ORDERS: "expireOrders",
  EXPIRE_FEATURED: "expireFeaturedListings",
  CHECK_PRICE_ALERTS: "checkPriceAlerts",
  SYNC_SHOP_NAME: "syncShopName",
  WEEKLY_MERCHANT_REPORT: "weeklyMerchantReport",
};

let connection = null;
let queue = null;

/**
 * One shared Redis connection, created on first use.
 *
 * maxRetriesPerRequest: null is not optional - BullMQ blocks on Redis while
 * waiting for work, and ioredis's default retry limit would kill that
 * connection. Upstash also requires TLS, which comes from the rediss:// URL.
 */
export const getConnection = () => {
  if (!process.env.REDIS_URL) return null;

  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    connection.on("error", (error) =>
      console.error("Redis connection error:", error.message),
    );
  }
  return connection;
};

export const getQueue = () => {
  const redis = getConnection();
  if (!redis) return null;

  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: redis });
  }
  return queue;
};

/**
 * Put a job on the queue. Returns false instead of throwing when no Redis is
 * configured, so the API runs perfectly well before Upstash is set up - the
 * background work is simply skipped rather than crashing a request.
 */
export const enqueue = async (name, data = {}, options = {}) => {
  const q = getQueue();

  if (!q) {
    console.warn(`Job "${name}" skipped - REDIS_URL is not set`);
    return false;
  }

  await q.add(name, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
    ...options,
  });

  return true;
};

/** Fire-and-forget. For callers that must not fail because a job failed. */
export const enqueueQuietly = (name, data = {}, options = {}) => {
  enqueue(name, data, options).catch((error) =>
    console.error(`Could not queue "${name}":`, error.message),
  );
};
