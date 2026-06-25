import { snapshot } from "@/lib/gateway/observe";

// Node runtime: reads the in-process observability ring (per-instance, like the
// cache and rate limiter — a shared store would aggregate across instances).
export const runtime = "nodejs";

export async function GET() {
  return new Response(JSON.stringify(snapshot()), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
