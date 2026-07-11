import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// SPEC-exact path: POST /api/auth/login
export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await auth.api.signInEmail({
    body,
    headers: req.headers,
    asResponse: true,
  });
  const data = res.body ? await res.json() : null;
  return NextResponse.json(data, {
    status: res.status,
    headers: res.headers,
  });
}
