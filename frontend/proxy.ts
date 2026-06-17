import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

import jwt from "jsonwebtoken";

export function proxy(
  request: NextRequest
) {

  const token =
    request.cookies.get(
      "token"
    )?.value;

  const pathname =
    request.nextUrl.pathname;

  /* NO TOKEN */

  if (
    !token &&
    (
      pathname.startsWith(
        "/admin"
      ) ||
      pathname.startsWith(
        "/csr"
      )
    )
  ) {

    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  /* VERIFY ROLE */

  if (token) {

    try {

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "SUPER_SECRET_KEY"
      ) as { role?: string };

      /* ADMIN ACCESS */

      if (
        pathname.startsWith(
          "/admin"
        ) &&
        decoded?.role !==
          "admin"
      ) {

        return NextResponse.redirect(
          new URL(
            "/csr",
            request.url
          )
        );
      }

      /* CSR ACCESS */

      if (
        pathname.startsWith(
          "/csr"
        ) &&
        decoded?.role !==
          "csr"
      ) {

        return NextResponse.redirect(
          new URL(
            "/admin",
            request.url
          )
        );
      }

    } catch {

      return NextResponse.redirect(
        new URL("/", request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/csr/:path*",
  ],
};
