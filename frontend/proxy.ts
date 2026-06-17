import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    console.error("[Security] JWT_SECRET missing or too short for middleware.");
  }
  return secret || "dev-only-insecure-secret-change-me-32chars";
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const pathname = request.nextUrl.pathname;

  if (!token && (pathname.startsWith("/admin") || pathname.startsWith("/csr"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { role?: string };

      if (pathname.startsWith("/admin") && decoded?.role !== "admin") {
        return NextResponse.redirect(new URL("/csr", request.url));
      }

      if (pathname.startsWith("/csr") && decoded?.role !== "csr") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/csr/:path*"],
};
