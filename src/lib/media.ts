import { db } from "./db";
import { media } from "./db/schema";
import { eq, and } from "drizzle-orm";

async function insertMedia({
  clientId,
  key,
  publicUrl,
  contentType,
  userId,
}: {
  clientId: string;
  key: string;
  publicUrl: string;
  contentType: string;
  userId: string;
}) {
  const result = await db.insert(media).values({
    clientId,
    key,
    publicUrl,
    contentType,
    metadata: { uploadedBy: userId, size: 0 },
  }).returning();
  return result[0];
}

async function getClientMedia({ clientId }: { clientId: string }) {
  return await db.query.media.findMany({
    where: eq(media.clientId, clientId),
    orderBy: (media, { desc }) => [desc(media.uploadedAt)],
  });
}

export { insertMedia, getClientMedia };
