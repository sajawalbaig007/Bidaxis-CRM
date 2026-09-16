import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type AppRole = "admin" | "csr" | "manager" | "technical_manager" | "accounts" | "estimator";

type TokenPayload = { role?: string; exp?: number; sid?: string };

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

function parseToken(token: string): { role: AppRole | null; ok: boolean } {
  try {
    const part = token.split(".")[1];
    if (!part) return { role: null, ok: false };
    const payload = JSON.parse(decodeBase64Url(part)) as TokenPayload;

    if (!payload.sid) return { role: null, ok: false };
    if (payload.exp && payload.exp * 1000 < Date.now()) return { role: null, ok: false };

    const role = (payload.role ?? "").toLowerCase();
    if (
      role === "admin" ||
      role === "csr" ||
      role === "manager" ||
      role === "technical_manager" ||
      role === "accounts" ||
      role === "estimator"
    ) {
      return { role, ok: true };
    }
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

function homeForRole(role: AppRole) {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  if (role === "technical_manager") return "/technical";
  if (role === "accounts") return "/accounts";
  if (role === "estimator") return "/estimator";
  return "/csr";
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const protectedPath =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/csr") ||
    pathname.startsWith("/manager") ||
    pathname.startsWith("/technical") ||
    pathname.startsWith("/accounts") ||
    pathname.startsWith("/estimator");

  if (!token) {
    if (protectedPath) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  const { role, ok } = parseToken(token);

  // Home can bounce logged-in users to their dashboard. Login pages must stay
  // reachable so a stale cookie cannot trap CEO / portal sign-in in a loop.
  if (pathname === "/") {
    if (ok && role) {
      return NextResponse.redirect(new URL(homeForRole(role), request.url));
    }
    if (!ok) {
      const res = NextResponse.next();
      res.cookies.delete("token");
      return res;
    }
    return NextResponse.next();
  }
  if (pathname.startsWith("/login")) {
    if (!ok) {
      const res = NextResponse.next();
      res.cookies.delete("token");
      return res;
    }
    return NextResponse.next();
  }

  if (!protectedPath) return NextResponse.next();

  if (!ok || !role) return redirectHomeClearCookie(request);

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }
  if (pathname.startsWith("/csr") && role !== "csr") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }
  if (pathname.startsWith("/manager") && role !== "manager") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }
  if (pathname.startsWith("/technical") && role !== "technical_manager" && role !== "admin") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }
  if (pathname.startsWith("/accounts") && role !== "accounts" && role !== "admin") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }
  if (pathname.startsWith("/estimator") && role !== "estimator") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login/:path*",
    "/admin/:path*",
    "/csr/:path*",
    "/manager/:path*",
    "/technical/:path*",
    "/accounts/:path*",
    "/estimator/:path*",
  ],
};
