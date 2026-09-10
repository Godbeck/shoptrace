import dotenv from "dotenv";
import { Worker } from "bullmq";
import connectDB from "../config/db.js";
import { QUEUE_NAME, JOBS, getConnection, getQueue } from "./queue.js";
import {
  runExpireOrders,
  runExpireFeaturedListings,
  runCheckPriceAlerts,
  runSyncShopName,
  runWeeklyMerchantReport,
} from "./handlers.js";

dotenv.config();

/**
 * This is a second process, started with `npm run worker`, not part of the API.
 *
 * Keeping them apart matters: a sweep that takes 30 seconds would otherwise
 * block the event loop that customers' requests are waiting on. On Railway
 * this deploys as its own service pointing at the same database and Redis.
 */

const connection = getConnection();

if (!connection) {
  console.error(
    "REDIS_URL is not set. The worker has nothing to connect to - " +
      "set it in .env, or run the expiry sweep by hand via " +
      "POST /api/admin/jobs/expire-orders.",
  );
  process.exit(1);
}

await connectDB();

/** One place that maps a job name to the function that does the work. */
const handlers = {
  [JOBS.EXPIRE_ORDERS]: runExpireOrders,
  [JOBS.EXPIRE_FEATURED]: runExpireFeaturedListings,
  [JOBS.CHECK_PRICE_ALERTS]: runCheckPriceAlerts,
  [JOBS.SYNC_SHOP_NAME]: runSyncShopName,
  [JOBS.WEEKLY_MERCHANT_REPORT]: runWeeklyMerchantReport,
};

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const handler = handlers[job.name];

    if (!handler) {
      throw new Error(`No handler for job "${job.name}"`);
    }

    return handler(job.data || {});
  },
  {
    connection,
    // Five jobs at a time. Low on purpose - these jobs are database-bound,
    // and a free Atlas tier has a modest connection limit.
    concurrency: 5,
  },
);

worker.on("completed", (job, result) => {
  console.log(`[job] ${job.name} done`, result || "");
});

worker.on("failed", (job, error) => {
  console.error(`[job] ${job?.name} failed:`, error.message);
});

/**
 * Repeatable schedules. upsertJobScheduler is idempotent - redeploying the
 * worker updates the existing schedule instead of stacking a second one, which
 * is exactly what you want when a deploy restarts this process.
 */
const queue = getQueue();

await queue.upsertJobScheduler(
  "expire-orders-every-minute",
  { every: 60 * 1000 },
  { name: JOBS.EXPIRE_ORDERS },
);

await queue.upsertJobScheduler(
  "expire-featured-hourly",
  { pattern: "0 * * * *" },
  { name: JOBS.EXPIRE_FEATURED },
);

await queue.upsertJobScheduler(
  "weekly-merchant-report",
  // 7am Monday, Accra time.
  { pattern: "0 7 * * 1", tz: "Africa/Accra" },
  { name: JOBS.WEEKLY_MERCHANT_REPORT },
);

console.log("Worker running. Schedules registered.");

// Finish the job in hand before dying, so a deploy does not abandon a sweep
// halfway through releasing stock.
const shutdown = async (signal) => {
  console.log(`${signal} received, closing worker...`);
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
