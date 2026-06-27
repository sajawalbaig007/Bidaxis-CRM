import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type TokenPayload = { role?: string; exp?: number; sid?: string };

function parseToken(token: string): { role: "admin" | "csr" | null; ok: boolean } {
  try {
    const part = token.split(".")[1];
    if (!part) return { role: null, ok: false };
    const payload = JSON.parse(
      Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as TokenPayload;

    if (!payload.sid) return { role: null, ok: false };
    if (payload.exp && payload.exp * 1000 < Date.now()) return { role: null, ok: false };

    const role = (payload.role ?? "").toLowerCase();
    if (role === "admin" || role === "csr") return { role, ok: true };
    return { role: null, ok: false };
  } catch {
    return { role: null, ok: false };
  }
}

function redirectHomeClearCookie(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.delete("token");
  return res;
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const protectedPath = pathname.startsWith("/admin") || pathname.startsWith("/csr");

  if (!token) {
    if (protectedPath) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  const { role, ok } = parseToken(token);

  if (pathname === "/" || pathname === "/login") {
    if (ok && role) {
      const dest = role === "admin" ? "/admin" : "/csr";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    if (!ok) return redirectHomeClearCookie(request);
    return NextResponse.next();
  }

  if (!protectedPath) return NextResponse.next();

  if (!ok || !role) return redirectHomeClearCookie(request);

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
