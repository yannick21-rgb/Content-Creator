import { Worker, Queue, Job, UnrecoverableError } from "bullmq";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { eq } from "drizzle-orm";
import { publishTargets, socialAccount as socialAccountTable, posts as postsTable } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getPublisher } from "@/lib/publish";
import type { PublishPlatform } from "@/lib/publish/provider";

console.log("[Worker] Starting BullMQ publish worker...");

const dlq = new Queue("social-publish:dlq", { connection: redis });

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

    const accessToken = decrypt({
      iv: account.iv,
      tag: account.tag,
      ciphertext: account.accessTokenEnc,
    });

    const publisher = getPublisher(platform as PublishPlatform);
    const result = await publisher.publish(post, target, { accessToken, platform: platform as PublishPlatform });

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

async function shutdown(signal: string) {
  console.log(`\n[Worker] Received ${signal}. Shutting down gracefully...`);
  await worker.close();
  await redis.quit();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("[Worker] BullMQ publish worker started. Waiting for jobs...");
