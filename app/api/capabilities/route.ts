import { embeddingAvailable } from "@/lib/gateway/embed";
import { judgeAvailable } from "@/lib/gateway/rerank";

// Node runtime: reads process env to report which tiers are live. Lets the
// playground tell the visitor (and the operator verifying a deploy) whether the
// semantic cache + judge are actually wired, instead of silently degrading to
// exact-only/mock when a key is missing.
export const runtime = "nodejs";

export async function GET() {
  const semantic = process.env.SEMANTIC_CACHE === "on" && embeddingAvailable();
  const judge = process.env.GUARD_JUDGE === "on" && judgeAvailable();
  const liveProvider = !!process.env.ANTHROPIC_API_KEY;
  const body = {
    semantic,
    judge,
    liveProvider,
    threshold: Number(process.env.CACHE_THRESHOLD ?? "0.92"),
    model: process.env.GATEWAY_PRIMARY_MODEL || "claude-haiku-4-5",
  };
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
