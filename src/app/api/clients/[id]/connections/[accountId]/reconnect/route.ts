import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { client, socialAccount } from "@/lib/db/schema";
import { requireClientScope } from "@/lib/clients";
import { errorResponse } from "@/lib/http";

type Params = { params: Promise<{ id: string; accountId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireClientScope();
    const { id, accountId } = await params;

    const [acc] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.id, accountId));
    if (!acc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const [owned] = await db
      .select()
      .from(client)
      .where(and(eq(client.id, id), eq(client.userId, userId)));
    if (!owned || acc.clientId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // One-click re-auth: re-initiate the OAuth flow for this account's platform.
    return NextResponse.redirect(
      `${req.nextUrl.origin}/api/clients/${id}/connections/${acc.platform}/start`,
    );
  } catch (e) {
    return errorResponse(e);
  }
}
