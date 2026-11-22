// Same-origin API path for hosts without a reverse proxy in front (e.g. Render, where the app and the API get different
// addresses). The browser calls /api/v1/... on this host, this handler forwards the request to the API over the private
// network, so session cookies stay first-party and no CORS is needed.
// It is off unless API_INTERNAL_URL is set: behind Caddy (deploy/Caddyfile) /api/* never reaches this app.
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Hop-by-hop headers and the ones fetch recomputes; forwarding them would break the proxied request or response.
const DROP_REQUEST = new Set(["host", "connection", "keep-alive", "transfer-encoding", "upgrade", "content-length", "accept-encoding", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto"]);
const DROP_RESPONSE = new Set(["connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length", "set-cookie"]);

function upstreamBase(): string | null {
  const raw = process.env.API_INTERNAL_URL?.trim();
  if (!raw) return null;
  return (/^https?:\/\//.test(raw) ? raw : `http://${raw}`).replace(/\/$/, "");
}

/** The client address as seen by the platform's edge proxy: the last X-Forwarded-For entry (the one the edge appended). */
function clientAddress(request: NextRequest): string | null {
  const chain = request.headers.get("x-forwarded-for");
  if (!chain) return null;
  const last = chain.split(",").map((part) => part.trim()).filter(Boolean).pop();
  return last ?? null;
}

async function forward(request: NextRequest): Promise<Response> {
  const base = upstreamBase();
  if (!base) return new Response("Not found", { status: 404 });

  const incoming = new URL(request.url);
  const target = `${base}${incoming.pathname}${incoming.search}`;
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });
  const client = clientAddress(request);
  if (client) headers.set("x-forwarded-for", client);
  headers.set("x-forwarded-host", request.headers.get("host") ?? incoming.host);
  headers.set("x-forwarded-proto", request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || incoming.protocol.replace(":", ""));

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  // A free API instance sleeps when idle. While it wakes, the host answers with its own page or its own 429 (not the API's
  // JSON), or the connection fails: such a request never reached the API and is sent again for up to 75 s. Each try has a time
  // limit, as Node would otherwise wait minutes for headers. A failed connection is retried only for reads.
  const send = () => fetch(target, { method: request.method, headers, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(hasBody ? 60_000 : 20_000) });
  const fromHost = (response: Response) => [429, 502, 503, 504].includes(response.status) && !(response.headers.get("content-type") ?? "").includes("application/json");
  const deadline = Date.now() + 75_000;
  let upstream: Response | null = null;
  while (true) {
    try {
      upstream = await send();
      if (!fromHost(upstream) || Date.now() > deadline) break;
      await upstream.body?.cancel().catch(() => undefined);
    } catch {
      if (hasBody || Date.now() > deadline) { upstream = null; break; }
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  if (!upstream || fromHost(upstream)) {
    return Response.json({ message: "API_WAKING_UP", error: { code: "API_UNAVAILABLE", message: "The API is waking up after being idle; this takes up to a minute. Try again shortly." } }, { status: 503 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key.toLowerCase())) responseHeaders.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
