// src/lib/posts.ts
import { db } from "./db";
import { posts, media, publishTargets } from "./db/schema";
import { eq, and, inArray, gte, desc } from "drizzle-orm";

export async function createPost({
  text,
  title,
  clientId,
  mediaIds = [],
}: {
  text: string;
  title?: string;
  clientId: string;
  mediaIds?: string[];
}) {
  const result = await db.insert(posts).values({
    clientId,
    title,
    text,
    multiImage: mediaIds.length > 1,
  }).returning({ id: posts.id });

  if (result.length && mediaIds.length > 0) {
    await db.update(media)
      .set({ postId: result[0].id })
      .where(inArray(media.id, mediaIds));
  }

  return result[0];
}

export async function getPost({ id, clientId }: { id: string; clientId: string }) {
  return await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.clientId, clientId)),
    with: {
      media: true,
    },
  });
}

export async function updatePost({
  id,
  clientId,
  text,
  title,
  mediaIds = [],
}: {
  id: string;
  clientId: string;
  text?: string;
  title?: string;
  mediaIds?: string[];
}) {
  const values: any = {};
  if (text !== undefined) values.text = text;
  if (title !== undefined) values.title = title;
  if (Object.keys(values).length === 0) return null;

  const result = await db.update(posts)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(posts.id, id), eq(posts.clientId, clientId)))
    .returning();

  if (result.length) {
    if (mediaIds.length > 0) {
      await db.update(media).set({ postId: null }).where(eq(media.postId, id));
      await db.update(media)
        .set({ postId: id })
        .where(inArray(media.id, mediaIds));
    } else {
      await db.update(media).set({ postId: null }).where(eq(media.postId, id));
    }
  }

  return result[0];
}

export async function listPosts({ clientId }: { clientId: string }) {
  return await db.query.posts.findMany({
    where: eq(posts.clientId, clientId),
    orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    with: {
      media: true,
    },
  });
}

export async function getScheduledPosts(clientId: string) {
  return await db.query.posts.findMany({
    where: and(
      eq(posts.clientId, clientId),
      gte(posts.scheduledAt as any, new Date()),
    ),
    orderBy: (posts, { asc }) => [asc(posts.scheduledAt as any)],
    with: {
      publishTargets: {
        with: {
          socialAccount: true,
        },
      },
    },
  });
}

export async function getPostWithTargets(id: string, clientId: string) {
  return await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.clientId, clientId)),
    with: {
      publishTargets: {
        with: {
          socialAccount: true,
        },
      },
      media: true,
    },
  });
}
