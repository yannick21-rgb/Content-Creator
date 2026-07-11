import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const protectedRoutes = ["/dashboard", "/clients"];
  const isProtected = protectedRoutes.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  if (!isProtected) return NextResponse.next();

  // Lightweight presence check (no DB/crypto in the edge runtime).
  // Better Auth's session cookie is namespaced "better-auth.*".
  const hasSession = [...req.cookies.getAll()].some((c) =>
    c.name.startsWith("better-auth"),
  );
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/clients/:path*"],
};
