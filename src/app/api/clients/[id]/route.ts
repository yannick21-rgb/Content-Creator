import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { client } from "@/lib/db/schema";
import { requireClientScope } from "@/lib/clients";
import { errorResponse } from "@/lib/http";

const patchSchema = z.object({ name: z.string().min(1).optional() });

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const userId = await requireClientScope();
    const { id } = await params;
    const [row] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, id), eq(client.userId, userId)));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireClientScope();
    const { id } = await params;
    const parsed = patchSchema.parse(await req.json());
    const [row] = await db
      .update(client)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(client.id, id), eq(client.userId, userId)))
      .returning();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const userId = await requireClientScope();
    const { id } = await params;
    const [row] = await db
      .delete(client)
      .where(and(eq(client.id, id), eq(client.userId, userId)))
      .returning();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // FK cascade removes only this client's social_account + oauth_state rows.
    return NextResponse.json({ deleted: row.id });
  } catch (e) {
    return errorResponse(e);
  }
}
