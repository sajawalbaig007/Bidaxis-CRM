import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

import jwt from "jsonwebtoken";

export function middleware(
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

      const decoded: any =
        jwt.decode(token);

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

    } catch (error) {

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