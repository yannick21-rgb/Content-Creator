import { Worker, Queue, Job, UnrecoverableError } from "bullmq";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { eq } from "drizzle-orm";
import { publishTargets, socialAccount as socialAccountTable, posts as postsTable } from "@/lib/db/schema";
import { getValidAccessToken, refreshSocialAccount, refreshExpiringAccounts } from "@/lib/oauth/refresh";
import { getPublisher } from "@/lib/publish";
import type { PublishPlatform } from "@/lib/publish/provider";

console.log("[Worker] Starting BullMQ publish worker...");

const dlq = new Queue("social-publish:dlq", { connection: redis });

// Recurring sweep: proactively refresh tokens nearing expiry so publishes don't
// fail and "reconnect required" stays rare (CONN-04).
const refreshSweep = new Queue("token-refresh-sweep", { connection: redis });

async function publishOnce(post: any, target: any, accessToken: string, platform: string) {
  const publisher = getPublisher(platform as PublishPlatform);
  return publisher.publish(post, target, {
    accessToken,
    platform: platform as PublishPlatform,
  });
}

function isAuthError(error?: string): boolean {
  return /expired|invalid|unauthorized|401|invalid_token|access token/i.test(
    error ?? "",
  );
}

const worker = new Worker<{
  publishTargetId: string;
  postId: string;
  clientId: string;
  platform: string;
}>(
  "social-publish",
  async (job: Job) => {
    const { publishTargetId, postId, clientId, platform } = job.data;

    const [target] = await db
      .select()
      .from(publishTargets)
      .where(eq(publishTargets.id, publishTargetId));

    if (!target) {
      throw new UnrecoverableError(`Publish target ${publishTargetId} not found`);
    }

    if (target.status === "published") {
      job.log("Target already published — skipping");
      return { status: "already_published" };
    }

    await db
      .update(publishTargets)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(publishTargets.id, publishTargetId));

    const [post] = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.id, postId));

    const [account] = await db
      .select()
      .from(socialAccountTable)
      .where(eq(socialAccountTable.id, target.socialAccountId));

    if (!post || !account) {
      throw new UnrecoverableError(`Post ${postId} or account not found`);
    }

    // Use a fresh/valid token — transparently refreshed if within the expiry window.
    const token = await getValidAccessToken(account.id);
    let accessToken = token.accessToken;

    let result = await publishOnce(post, target, accessToken, platform);

    // On an auth error, try a hard refresh + single retry before failing.
    if (!result.success && isAuthError(result.error) && token.refreshed === false) {
      const refreshed = await refreshSocialAccount(account.id);
      if (refreshed) {
        const fresh = await getValidAccessToken(account.id);
        job.log("Token refreshed after auth error — retrying publish");
        result = await publishOnce(post, target, fresh.accessToken, platform);
      }
    }

    if (result.success) {
      await db
        .update(publishTargets)
        .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(publishTargets.id, publishTargetId));
      return { status: "published", platformRef: result.platformRef };
    } else {
      throw new Error(result.error ?? "Publish failed");
    }
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

worker.on("failed", async (job: Job | undefined, err: Error) => {
  if (!job) return;
  const exhausted = job.attemptsMade >= (job.opts.attempts ?? 3);
  if (exhausted) {
    const publishTargetId = job.data.publishTargetId;
    if (publishTargetId) {
      await db
        .update(publishTargets)
        .set({ status: "failed", errorMessage: err.message, updatedAt: new Date() })
        .where(eq(publishTargets.id, publishTargetId));
    }
    await dlq.add("dead-letter", {
      originalJobId: job.id,
      data: job.data,
      failedReason: err.message,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
    });
    console.error(`[DLQ] Job ${job.id} moved to dead-letter: ${err.message}`);
  }
});

worker.on("error", (err: Error) => {
  console.error("[Worker] Redis/connection error:", err);
});

// Recurring token-refresh sweep worker (CONN-04).
const refreshWorker = new Worker(
  "token-refresh-sweep",
  async () => {
    const summary = await refreshExpiringAccounts();
    console.log(
      `[refresh-sweep] checked=${summary.checked} refreshed=${summary.refreshed} failed=${summary.failed}`,
    );
    return summary;
  },
  { connection: redis, concurrency: 1 },
);

refreshWorker.on("error", (err: Error) => {
  console.error("[refresh-sweep] Redis/connection error:", err);
});

// Schedule a daily sweep at 03:00 (server time). Idempotent across restarts.
refreshSweep
  .upsertJobScheduler(
    "token-refresh-daily",
    { pattern: "0 3 * * *" },
    { name: "token-refresh-daily", data: {}, opts: { removeOnComplete: true } },
  )
  .then(() => console.log("[refresh-sweep] Daily scheduler registered"))
  .catch((e) => console.error("[refresh-sweep] Failed to register scheduler:", e));

async function shutdown(signal: string) {
  console.log(`\n[Worker] Received ${signal}. Shutting down gracefully...`);
  await worker.close();
  await refreshWorker.close();
  await refreshSweep.close();
  await redis.quit();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("[Worker] BullMQ publish worker started. Waiting for jobs...");
