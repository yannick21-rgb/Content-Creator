import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const publishQueue = new Queue("social-publish", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

export async function enqueuePublishJob({
  publishTargetId,
  postId,
  clientId,
  platform,
  delayMs,
}: {
  publishTargetId: string;
  postId: string;
  clientId: string;
  platform: string;
  delayMs: number;
}) {
  await publishQueue.add(
    "publish",
    { publishTargetId, postId, clientId, platform },
    {
      jobId: publishTargetId,
      delay: delayMs,
    },
  );
}

export function computeDelayMs(scheduledAt: Date): number {
  const delay = scheduledAt.getTime() - Date.now();
  return Math.max(delay, 1000);
}
