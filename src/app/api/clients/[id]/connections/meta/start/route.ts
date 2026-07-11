import { NextRequest, NextResponse } from "next/server";
import { requireUser, assertClientOwned, HttpError } from "@/lib/clients";
import { beginOAuth } from "@/lib/oauth/start";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(req.headers);
    const { id } = await params;
    await assertClientOwned(id, userId);
    return await beginOAuth("meta", id, req);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
