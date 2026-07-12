import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireUser,
  assertClientOwned,
  HttpError,
} from "@/lib/clients";
import { db } from "@/lib/db";
import { client } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const patchSchema = z.object({ name: z.string().min(1).optional() });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(_req.headers);
    const { id } = await params;
    await assertClientOwned(id, userId);
    const [row] = await db.select().from(client).where(eq(client.id, id));
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(req.headers);
    const { id } = await params;
    await assertClientOwned(id, userId);
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const [row] = await db
      .update(client)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(client.id, id), eq(client.userId, userId)))
      .returning();
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(_req.headers);
    const { id } = await params;
    await assertClientOwned(id, userId);
    // FK cascade removes only this client's socialAccount + oauthState rows.
    await db
      .delete(client)
      .where(and(eq(client.id, id), eq(client.userId, userId)));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
