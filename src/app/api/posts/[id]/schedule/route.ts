import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId, HttpError } from "@/lib/clients";
import { getPost } from "@/lib/posts";
import { db } from "@/lib/db";
import { publishTargets, posts as postsTable, socialAccount } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { enqueuePublishJob, computeDelayMs } from "@/lib/queue";
import { timezoneSchema, localToUtc } from "@/lib/timezone";

const scheduleSchema = z.object({
  scheduledAt: z.string().min(1),
  timezone: timezoneSchema,
  socialAccountIds: z.array(z.string().uuid()).min(1),
});

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
    const body = await req.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { scheduledAt, timezone, socialAccountIds } = parsed.data;
    const scheduledAtUtc = localToUtc(scheduledAt, timezone);
    if (scheduledAtUtc.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "scheduledAt must be in the future" },
        { status: 400 },
      );
    }
    await db
      .update(postsTable)
      .set({ scheduledAt: scheduledAtUtc, timezone, status: "scheduled", updatedAt: new Date() })
      .where(and(eq(postsTable.id, id), eq(postsTable.clientId, activeClientId)));
    const delayMs = computeDelayMs(scheduledAtUtc);
    const targets = [];
    for (const accountId of socialAccountIds) {
      const [account] = await db
        .select({ platform: socialAccount.platform })
        .from(socialAccount)
        .where(and(
          eq(socialAccount.id, accountId),
          eq(socialAccount.clientId, activeClientId),
        ));
      if (!account) {
        return NextResponse.json(
          { error: `Social account ${accountId} not found or access denied` },
          { status: 404 },
        );
      }
      const [target] = await db
        .insert(publishTargets)
        .values({ postId: id, socialAccountId: accountId, status: "scheduled" })
        .returning();
      targets.push(target.id);
      await enqueuePublishJob({
        publishTargetId: target.id,
        postId: id,
        clientId: activeClientId,
        platform: account.platform,
        delayMs,
      });
    }
    return NextResponse.json({ postId: id, targets, scheduledAt: scheduledAtUtc.toISOString(), timezone }, { status: 201 });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
