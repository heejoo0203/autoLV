import { NextRequest, NextResponse } from "next/server";

type ProxyPayload = {
  path?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
};

const DEFAULT_VWORLD_BASE_URL = "https://api.vworld.kr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const proxyToken = process.env.VWORLD_PROXY_TOKEN?.trim() ?? "";
  const expectedAuth = proxyToken ? request.headers.get("x-vworld-proxy-token") ?? "" : "";

  if (proxyToken && expectedAuth !== proxyToken) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "유효하지 않은 프록시 토큰입니다." }, { status: 401 });
  }

  const vworldKey = process.env.VWORLD_API_KEY?.trim() ?? "";
  if (!vworldKey) {
    return NextResponse.json({ code: "KEY_MISSING", message: "VWORLD_API_KEY 설정이 필요합니다." }, { status: 500 });
  }

  const body = (await safeJson(request)) as ProxyPayload;
  const path = (body.path ?? "").trim();
  if (!path.startsWith("/") || path.includes("://")) {
    return NextResponse.json({ code: "INVALID_PATH", message: "유효하지 않은 VWorld 경로입니다." }, { status: 400 });
  }

  const vworldBaseUrl = (process.env.VWORLD_API_BASE_URL?.trim() || DEFAULT_VWORLD_BASE_URL).replace(/\/+$/, "");
  const vworldDomain = process.env.VWORLD_API_DOMAIN?.trim() ?? "";

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(body.params ?? {})) {
    if (value === null || value === undefined) continue;
    query.set(key, String(value));
  }
  query.set("key", vworldKey);
  if (vworldDomain) {
    query.set("domain", vworldDomain);
  }

  const targetUrl = `${vworldBaseUrl}${path}?${query.toString()}`;
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "autoLV-web-proxy/1.0",
        Connection: "close",
      },
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ code: "PROXY_FETCH_FAILED", message }, { status: 502 });
  }
}

async function safeJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

