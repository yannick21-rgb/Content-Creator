import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { client, socialAccount } from "@/lib/db/schema";
import { requireClientScope, listConnections } from "@/lib/clients";
import { statusFor } from "@/lib/connection-status";
import { errorResponse } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const userId = await requireClientScope();
    const { id } = await params;
    const [owned] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, id), eq(client.userId, userId)));
    if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = await listConnections(id);
    // Omit all token fields (CONN-03) — never serialize iv/tag/ciphertext.
    const safe = rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      platformAccountId: r.platformAccountId,
      name: r.name,
      expiresAt: r.expiresAt,
      status: statusFor(r.expiresAt),
      createdAt: r.createdAt,
    }));
    return NextResponse.json(safe);
  } catch (e) {
    return errorResponse(e);
  }
}
