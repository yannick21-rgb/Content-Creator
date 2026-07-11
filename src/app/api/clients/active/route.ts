import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireClientScope,
  setActiveClientCookie,
  listClients,
} from "@/lib/clients";
import { errorResponse } from "@/lib/http";

const schema = z.object({ clientId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const userId = await requireClientScope();
    const { clientId } = schema.parse(await req.json());
    const owned = await listClients(userId);
    if (!owned.some((c) => c.id === clientId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await setActiveClientCookie(clientId);
    return NextResponse.json({ ok: true, clientId });
  } catch (e) {
    return errorResponse(e);
  }
}
