import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function roleFromToken(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(
      Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { role?: string };
    const role = (payload.role ?? "").toLowerCase();
    return role === "admin" || role === "csr" ? role : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const protectedPath = pathname.startsWith("/admin") || pathname.startsWith("/csr");

  if (!token) {
    if (protectedPath) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  const role = roleFromToken(token);

  if (pathname === "/" || pathname === "/login") {
    if (role === "admin") return NextResponse.redirect(new URL("/admin", request.url));
    if (role === "csr") return NextResponse.redirect(new URL("/csr", request.url));
    return NextResponse.next();
  }

  if (!protectedPath) return NextResponse.next();

  if (!role) {
    const res = NextResponse.redirect(new URL("/", request.url));
    res.cookies.delete("token");
    return res;
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/csr", request.url));
  }
  if (pathname.startsWith("/csr") && role !== "csr") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/csr/:path*"],
};
