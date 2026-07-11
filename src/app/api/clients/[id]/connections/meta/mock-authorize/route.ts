import { NextRequest, NextResponse } from "next/server";

// Mock Meta authorization endpoint: immediately bounces back to the callback
// with a fixed code (so the full connect flow runs without an approved app).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const state = req.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }
  const origin = req.nextUrl.origin;
  return NextResponse.redirect(
    `${origin}/api/clients/${id}/connections/meta/callback?code=MOCK_meta_CODE&state=${state}`,
  );
}
