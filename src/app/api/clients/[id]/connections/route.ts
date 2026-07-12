import { NextRequest, NextResponse } from "next/server";
import { requireUser, assertClientOwned, listConnections, HttpError } from "@/lib/clients";

// GET /api/clients/[id]/connections — scoped list with status, token fields omitted.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(_req.headers);
    const { id } = await params;
    await assertClientOwned(id, userId);
    const rows = await listConnections(id);
    // listConnections already omits ciphertext/iv/tag.
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
