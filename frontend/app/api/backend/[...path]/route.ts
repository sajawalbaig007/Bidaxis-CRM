import { NextRequest, NextResponse } from "next/server";

const BACKEND_ROOT = (process.env.BACKEND_URL ?? "http://localhost:5000").replace(/\/$/, "");

const SKIP_REQ_HEADERS = new Set(["host", "connection", "content-length"]);
const SKIP_RES_HEADERS = new Set(["transfer-encoding", "connection", "content-encoding"]);

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join("/");
  const target = `${BACKEND_ROOT}/api/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!SKIP_REQ_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method:  req.method,
    headers,
    cache:   "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    console.error("[api/backend proxy] fetch failed:", target, err);
    return NextResponse.json(
      {
        success: false,
        message: `Backend unavailable at ${BACKEND_ROOT}. Set BACKEND_URL on Vercel.`,
      },
      { status: 502 }
    );
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (SKIP_RES_HEADERS.has(lower)) return;
    if (lower === "set-cookie") {
      resHeaders.append(key, value);
    } else {
      resHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status:     upstream.status,
    statusText: upstream.statusText,
    headers:    resHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export const GET     = handle;
export const POST    = handle;
export const PUT     = handle;
export const PATCH   = handle;
export const DELETE  = handle;
export const OPTIONS = handle;
