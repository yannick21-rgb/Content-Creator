import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireUser,
  assertClientOwned,
  setActiveClientCookie,
  HttpError,
} from "@/lib/clients";

const schema = z.object({ clientId: z.string().uuid() });

// Sets the active-client cookie (D-01, D-02). Called by the nav dropdown.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    await assertClientOwned(parsed.data.clientId, userId);
    const res = NextResponse.json({ ok: true });
    setActiveClientCookie(parsed.data.clientId, res);
    return res;
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
