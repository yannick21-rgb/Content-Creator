import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireUser,
  listClients,
  setActiveClientCookie,
  clientConnectionSummary,
  HttpError,
} from "@/lib/clients";
import { db } from "@/lib/db";
import { client } from "@/lib/db/schema";

const createSchema = z.object({ name: z.string().min(1) });

export async function GET() {
  try {
    const userId = await requireUser();
    const rows = await listClients(userId);
    const withSummary = await Promise.all(
      rows.map(async (c) => {
        const summary = await clientConnectionSummary(c.id);
        return { ...c, ...summary };
      }),
    );
    return NextResponse.json(withSummary);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const [row] = await db
      .insert(client)
      .values({ userId, name: parsed.data.name })
      .returning();
    await setActiveClientCookie(row.id);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
