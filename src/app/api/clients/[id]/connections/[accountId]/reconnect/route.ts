import { NextRequest, NextResponse } from "next/server";
import { requireUser, assertClientOwned, HttpError } from "@/lib/clients";
import { db } from "@/lib/db";
import { socialAccount } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// One-click re-auth (CONN-04): re-initiate OAuth for a specific account's platform.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> },
) {
  try {
    const userId = await requireUser(req.headers);
    const { id, accountId } = await params;
    await assertClientOwned(id, userId);

    const [account] = await db
      .select()
      .from(socialAccount)
      .where(
        and(eq(socialAccount.id, accountId), eq(socialAccount.clientId, id)),
      );
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    const origin = req.nextUrl.origin;
    return NextResponse.redirect(
      `${origin}/api/clients/${id}/connections/${account.platform}/start`,
    );
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
