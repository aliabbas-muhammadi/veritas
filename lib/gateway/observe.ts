/**
 * Observability: a fail-soft, in-memory ring of OpenTelemetry GenAI-shaped
 * events ({@link ObserveEvent}, keyed with the portable `gen_ai.*` conventions
 * plus `veritas.*` extras), and a `snapshot()` that aggregates them for the
 * /api/metrics endpoint and the playground's live strip.
 *
 * What the dashboard actually needs (and most cost dashboards get wrong):
 * latency as PERCENTILES not averages, time-to-first-token for streaming, cache
 * hit rate split by tier, $ saved (not just $ spent), and the failover-rescued
 * rate. This is a sidecar — never on the request critical path.
 */
import type { ObserveEvent } from "./types";

const MAX = 1000;
const ring: ObserveEvent[] = [];

export function record(ev: ObserveEvent): void {
  ring.push(ev);
  if (ring.length > MAX) ring.shift();
  // Optional: emit an OTel GenAI-shaped line for an external collector to scrape.
  if (process.env.OBSERVE_LOG === "on") console.log("gen_ai", JSON.stringify(ev));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]!);
}

export type Snapshot = {
  requests: number;
  cache: { exact: number; semantic: number; miss: number; hitRate: number };
  latency: { ttftP50: number; ttftP95: number; totalP50: number; totalP95: number };
  cost: { spentUsd: number; savedUsd: number };
  resilience: { rescued: number; rescuedRate: number };
};

export function snapshot(): Snapshot {
  const n = ring.length;
  const tiers = { exact: 0, semantic: 0, miss: 0 };
  let spent = 0;
  let saved = 0;
  let rescued = 0;
  const ttfts: number[] = [];
  const totals: number[] = [];

  for (const e of ring) {
    const tier = e["veritas.cache.tier"];
    if (tier === "exact") tiers.exact++;
    else if (tier === "semantic") tiers.semantic++;
    else tiers.miss++;
    spent += e["veritas.cost.dollars"] ?? 0;
    saved += e["veritas.cache.dollars_saved"] ?? 0;
    if (e["veritas.resilience.rescued"]) rescued++;
    const ttft = e["veritas.latency.ttft_ms"];
    if (typeof ttft === "number") ttfts.push(ttft);
    totals.push(e["veritas.latency.total_ms"]);
  }
  ttfts.sort((a, b) => a - b);
  totals.sort((a, b) => a - b);

  const hits = tiers.exact + tiers.semantic;
  const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
  return {
    requests: n,
    cache: { ...tiers, hitRate: n ? round4(hits / n) : 0 },
    latency: {
      ttftP50: percentile(ttfts, 50),
      ttftP95: percentile(ttfts, 95),
      totalP50: percentile(totals, 50),
      totalP95: percentile(totals, 95),
    },
    cost: { spentUsd: round4(spent), savedUsd: round4(saved) },
    resilience: { rescued, rescuedRate: n ? round4(rescued / n) : 0 },
  };
}

/** Test/demo hook. */
export function reset(): void {
  ring.length = 0;
}
