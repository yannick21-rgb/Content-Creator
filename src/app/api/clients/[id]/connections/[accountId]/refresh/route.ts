import { NextRequest, NextResponse } from "next/server";
import { requireUser, assertClientOwned, HttpError } from "@/lib/clients";
import { db } from "@/lib/db";
import { socialAccount } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { refreshSocialAccount } from "@/lib/oauth/refresh";

// Force-refresh a connected account's access token (CONN-04). Returns the new
// expiry. Falls back to manual re-auth when the token can't be refreshed.
export async function POST(
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

    const refreshed = await refreshSocialAccount(accountId);
    if (!refreshed) {
      return NextResponse.json(
        {
          refreshed: false,
          reconnectRequired: true,
          message: "Token could not be refreshed — re-auth required.",
        },
        { status: 200 },
      );
    }

    const [updated] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.id, accountId));
    return NextResponse.json({
      refreshed: true,
      reconnectRequired: false,
      expiresAt: updated.expiresAt,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
