import { runGateway } from "@/lib/gateway";
import { encodeEvent, STREAM_HEADERS } from "@/lib/gateway/stream";
import type { GatewayRequest, ProviderName } from "@/lib/gateway/types";
import type { Message, Role } from "@/lib/gateway/providers/types";

// Node runtime: the gateway uses node:crypto (scope hash) and isn't edge-bound.
export const runtime = "nodejs";

const MAX_QUERY_LEN = 4000;
const DEFAULT_MODEL = process.env.GATEWAY_PRIMARY_MODEL || "claude-haiku-4-5";
const DEFAULT_MAX_TOKENS = 512;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20; // requests per IP per window — a public demo over paid APIs

const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? (xff.split(",")[0] ?? "unknown").trim() : "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  }
  return recent.length > RATE_MAX;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const VALID_ROLES: Role[] = ["user", "assistant"];

/** Parse + validate the request body into a normalized GatewayRequest. */
function parseBody(body: unknown): GatewayRequest | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "body must be an object" };
  const b = body as Record<string, unknown>;

  const rawMessages = b.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { error: "messages is required (non-empty array)" };
  }
  const messages: Message[] = [];
  for (const m of rawMessages) {
    if (typeof m !== "object" || m === null) return { error: "each message must be an object" };
    const mm = m as Record<string, unknown>;
    if (!VALID_ROLES.includes(mm.role as Role)) return { error: "invalid message role" };
    if (typeof mm.content !== "string") return { error: "message content must be a string" };
    messages.push({ role: mm.role as Role, content: mm.content });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser || !lastUser.content.trim()) return { error: "a non-empty user message is required" };
  if (lastUser.content.length > MAX_QUERY_LEN) {
    return { error: `query too long (max ${MAX_QUERY_LEN} characters)` };
  }

  const model = typeof b.model === "string" && b.model ? b.model : DEFAULT_MODEL;
  const maxTokens = typeof b.maxTokens === "number" ? b.maxTokens : DEFAULT_MAX_TOKENS;
  const temperature = typeof b.temperature === "number" ? b.temperature : 0;
  const system = typeof b.system === "string" ? b.system : undefined;
  const forceOutage =
    b.forceOutage === "anthropic" || b.forceOutage === "openai" || b.forceOutage === "mock"
      ? (b.forceOutage as ProviderName)
      : null;
  const cache =
    typeof b.cache === "object" && b.cache !== null
      ? (b.cache as GatewayRequest["cache"])
      : undefined;

  return { system, messages, model, temperature, maxTokens, forceOutage, cache };
}

/**
 * Streams a normalized answer as newline-delimited JSON (NDJSON): a `meta` event
 * first (cache verdict + chosen provider), then `text` deltas, then `done` — or
 * `error`. A cache hit replays its stored events at $0; a miss streams from the
 * chosen provider (mock when no keys are set) and caches the result.
 */
export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) {
    return json({ error: "Rate limit exceeded — try again in a moment." }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const parsed = parseBody(body);
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runGateway(parsed, req.signal)) {
          controller.enqueue(encodeEvent(ev));
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          controller.enqueue(
            encodeEvent({
              type: "error",
              message: err instanceof Error ? err.message : "gateway error",
            }),
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
}
