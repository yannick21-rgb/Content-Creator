import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { requireUser, getActiveClientId, HttpError } from "@/lib/clients";
import { getPost } from "@/lib/posts";
import { db } from "@/lib/db";
import { publishTargets, posts as postsTable, socialAccount } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { enqueuePublishJob } from "@/lib/queue";

const publishSchema = z.object({
  socialAccountIds: z.array(z.string().uuid()).min(1, "At least one target required"),
});

async function checkRateLimit(clientId: string, platform: string, accountId: string): Promise<{ allowed: boolean; resetTime?: number }> {
  try {
    const redisKey = `rate_limit:${platform}:${clientId}:${accountId}`;
    const current = await redis.incr(redisKey);
    if (current === 1) {
      await redis.expire(redisKey, 3600);
    }
    const limit = parseInt(process.env.RATE_LIMIT_PER_HOUR || "10");
    const resetTime = Math.floor(Date.now() / 1000) + 3600;
    return { allowed: current <= limit, resetTime };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { allowed: true };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const { id } = await params;
    const post = await getPost({ id, clientId: activeClientId });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.status === "published") {
      return NextResponse.json({ error: "Post already published" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { socialAccountIds } = parsed.data;

    const accounts = await db
      .select()
      .from(socialAccount)
      .where(
        and(
          eq(socialAccount.clientId, activeClientId),
          inArray(socialAccount.platform, ["meta", "instagram", "linkedin"]),
        ),
      );
    const validIds = new Set(accounts.map((a) => a.id));
    for (const accId of socialAccountIds) {
      if (!validIds.has(accId)) {
        return NextResponse.json(
          { error: `Account ${accId} not found or not a valid target` },
          { status: 404 },
        );
      }
    }

    const accountsToPublish = accounts.filter((a) => socialAccountIds.includes(a.id));

    for (const account of accountsToPublish) {
      const platform = account.platform as string;
      const result = await checkRateLimit(activeClientId, platform, account.id);
      if (!result.allowed) {
        return NextResponse.json(
          {
            error: `Rate limit exceeded for ${platform}. Try again later.`,
            resetTime: result.resetTime,
          },
          { status: 429 },
        );
      }
    }

    await db
      .update(postsTable)
      .set({ status: "scheduled", updatedAt: new Date() })
      .where(and(eq(postsTable.id, id), eq(postsTable.clientId, activeClientId)));

    const targets = [];
    for (const accountId of socialAccountIds) {
      const account = accounts.find((a: any) => a.id === accountId);
      const [target] = await db
        .insert(publishTargets)
        .values({ postId: id, socialAccountId: accountId, status: "scheduled" })
        .returning();
      targets.push(target.id);
      await enqueuePublishJob({
        publishTargetId: target.id,
        postId: id,
        clientId: activeClientId,
        platform: account?.platform ?? "meta",
        delayMs: 0,
      });
    }
    return NextResponse.json(
      { postId: id, targets, status: "publishing" },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
