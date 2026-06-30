"use client";

import { useEffect, useState } from "react";
import type { Metrics } from "./gateway-client";

/**
 * The live observability strip — a real read of `GET /api/metrics` (the in-memory
 * OTel `gen_ai.*` ring), refreshed after each turn and on a slow poll. Shows what
 * cost dashboards usually get wrong: hit rate by tier, $ saved (not just spent),
 * guard blocks, and latency as percentiles. Figures are engraved `tnum` gauges
 * that settle once; no count-up tickers.
 */
export function MetricsStrip({ refreshKey }: { refreshKey: number }) {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/metrics", { cache: "no-store" })
        .then((r) => r.json())
        .then((data: Metrics) => {
          if (alive) setM(data);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshKey]);

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const usd = (x: number) => `$${x.toFixed(4)}`;
  const savedShare =
    m && m.cost.spentUsd + m.cost.savedUsd > 0
      ? m.cost.savedUsd / (m.cost.spentUsd + m.cost.savedUsd)
      : 0;

  return (
    <div className="rounded-xl border border-line bg-paper-sunken/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">Live metrics · /api/metrics</h2>
        <span className="font-mono text-[11px] text-ink-faint">
          {m ? `${m.requests} req` : "…"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="hit rate" value={m ? pct(m.cache.hitRate) : "—"} />
        <Stat label="exact · semantic" value={m ? `${m.cache.exact} · ${m.cache.semantic}` : "—"} />
        <Stat
          label="guard blocks"
          value={m ? String(m.guard.blocked) : "—"}
          accent={!!m && m.guard.blocked > 0}
        />
        <Stat label="$ saved" value={m ? `${usd(m.cost.savedUsd)} (${pct(savedShare)})` : "—"} />
        <Stat label="TTFT p50/p95" value={m ? `${m.latency.ttftP50}/${m.latency.ttftP95}ms` : "—"} />
        <Stat
          label="rescued"
          value={m ? String(m.resilience.rescued) : "—"}
          accent={!!m && m.resilience.rescued > 0}
        />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd
        className={
          "mt-0.5 font-mono text-sm font-medium tabular-nums " +
          (accent ? "text-accent-strong" : "text-ink")
        }
      >
        {value}
      </dd>
    </div>
  );
}
