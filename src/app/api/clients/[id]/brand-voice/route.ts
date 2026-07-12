import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, assertClientOwned, HttpError } from "@/lib/clients";
import { db } from "@/lib/db";
import { brandVoice } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  tone: z.enum(["professional", "casual", "humorous"]),
  styleGuidelines: z.string().max(5000).optional(),
});

async function loadRow(clientId: string) {
  const [row] = await db
    .select()
    .from(brandVoice)
    .where(eq(brandVoice.clientId, clientId));
  return row;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(_req.headers);
    const { id } = await params;
    await assertClientOwned(id, userId);
    const row = await loadRow(id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(req.headers);
    const { id } = await params;
    await assertClientOwned(id, userId);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await loadRow(id);
    const now = new Date();
    let row;
    if (existing) {
      [row] = await db
        .update(brandVoice)
        .set({
          tone: parsed.data.tone,
          styleGuidelines: parsed.data.styleGuidelines ?? null,
          updatedAt: now,
        })
        .where(eq(brandVoice.clientId, id))
        .returning();
    } else {
      [row] = await db
        .insert(brandVoice)
        .values({
          clientId: id,
          tone: parsed.data.tone,
          styleGuidelines: parsed.data.styleGuidelines ?? null,
        })
        .returning();
    }
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return PUT(req, { params });
}
