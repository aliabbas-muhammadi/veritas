"use client";

import { useEffect, useRef, useState } from "react";
import { CacheBadge } from "./CacheBadge";
import { MetricsStrip } from "./MetricsStrip";
import { OutageToggle } from "./OutageToggle";
import {
  SCENARIO,
  streamChat,
  type Capabilities,
  type ProviderName,
  type Scenario,
  type Turn,
} from "./gateway-client";

export function Playground() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [outage, setOutage] = useState(false);
  const [running, setRunning] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [metricsKey, setMetricsKey] = useState(0);
  const idRef = useRef(1);

  useEffect(() => {
    fetch("/api/capabilities", { cache: "no-store" })
      .then((r) => r.json())
      .then((c: Capabilities) => setCaps(c))
      .catch(() => {});
  }, []);

  async function send(query: string, forceOutage: ProviderName | null) {
    if (!query.trim() || running) return;
    setRunning(true);
    const id = idRef.current++;
    setTurns((t) => [
      { id, query, text: "", streaming: true, outage: forceOutage },
      ...t,
    ]);
    const patch = (p: Partial<Turn>) =>
      setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

    let acc = "";
    try {
      for await (const ev of streamChat(query, { forceOutage })) {
        if (ev.type === "meta") {
          patch({
            cache: ev.cache,
            similarity: ev.similarity,
            provider: ev.provider,
            model: ev.model,
            guard: ev.guard,
            rescued: ev.rescued,
          });
        } else if (ev.type === "text") {
          acc += ev.text;
          patch({ text: acc });
        } else if (ev.type === "done") {
          patch({
            done: true,
            cached: ev.cached,
            ttftMs: ev.ttftMs,
            totalMs: ev.totalMs,
            costUsd: ev.costUsd,
            streaming: false,
          });
        } else if (ev.type === "error") {
          patch({ error: ev.message, streaming: false });
        }
      }
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : "request failed", streaming: false });
    } finally {
      patch({ streaming: false });
      setRunning(false);
      setMetricsKey((k) => k + 1);
    }
  }

  async function runStep(i: number, s: Scenario) {
    if (s.forceOutage) setOutage(true);
    await send(s.query, s.forceOutage ?? (outage ? "anthropic" : null));
    setTourIdx(Math.min(i + 1, SCENARIO.length));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput("");
    send(q, outage ? "anthropic" : null);
  }

  // Group the scenario into its narrative arcs for display.
  const arcs: { arc: string; steps: { i: number; s: Scenario }[] }[] = [];
  SCENARIO.forEach((s, i) => {
    const last = arcs[arcs.length - 1];
    if (last && last.arc === s.arc) last.steps.push({ i, s });
    else arcs.push({ arc: s.arc, steps: [{ i, s }] });
  });

  return (
    <div className="space-y-6">
      {caps && <ModeBanner caps={caps} />}

      <MetricsStrip refreshKey={metricsKey} />

      {/* The guided tour */}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
          Guided tour — click in order
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Each &ldquo;prime&rdquo; caches an answer the next step tries to reuse. Watch the
          verdict on every turn below.
        </p>
        <div className="mt-3 space-y-3">
          {arcs.map((group) => (
            <div key={group.arc}>
              <p className="text-[11px] font-medium text-zinc-400">{group.arc}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {group.steps.map(({ i, s }) => (
                  <button
                    key={i}
                    type="button"
                    disabled={running}
                    onClick={() => runStep(i, s)}
                    title={s.hint}
                    className={`rounded-lg border px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40 ${
                      i === tourIdx
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-60">{i + 1}</span>{" "}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-400">
          {tourIdx >= SCENARIO.length
            ? "Tour complete — try your own questions below."
            : `Next up: ${SCENARIO[tourIdx]?.hint}`}
        </p>
      </section>

      {/* Free-form input */}
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={running}
            placeholder="Ask anything — or paraphrase a question you already asked…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={running || !input.trim()}
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {running ? "…" : "Send"}
          </button>
        </div>
        <OutageToggle on={outage} onChange={setOutage} disabled={running} />
      </form>

      {/* Transcript — newest first */}
      <div className="space-y-3">
        {turns.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800">
            Start the guided tour, or ask a question.
          </p>
        )}
        {turns.map((turn) => (
          <TurnCard key={turn.id} turn={turn} />
        ))}
      </div>
    </div>
  );
}

function ModeBanner({ caps }: { caps: Capabilities }) {
  const live = caps.semantic && caps.judge;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs ${
        live
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300"
      }`}
    >
      <span className="font-medium">{live ? "Live mode" : "Limited mode"}</span>
      <span className="opacity-80">
        semantic cache {caps.semantic ? "on" : "off"} · judge {caps.judge ? "on" : "off"} ·
        τ {caps.threshold} · {caps.model}
      </span>
      {!live && (
        <span className="opacity-80">
          — set OPENAI_API_KEY + ANTHROPIC_API_KEY (and SEMANTIC_CACHE=on, GUARD_JUDGE=on) for
          the full cache + guard.
        </span>
      )}
    </div>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {turn.query}
        </p>
        <CacheBadge turn={turn} />
      </div>

      {turn.guard && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Close embedding (cosine {turn.guard.similarity.toFixed(2)} ≥ τ), opposite intent — a
          fixed threshold would have served the cached answer to{" "}
          <span className="font-medium">&ldquo;{turn.guard.candidate}&rdquo;</span>. The{" "}
          {turn.guard.by === "judge" ? "LLM judge" : "keyless guard"} caught the inversion, so a
          fresh, correct answer was generated instead.
        </p>
      )}

      {turn.error ? (
        <p className="mt-2 font-mono text-xs text-red-600 dark:text-red-400">{turn.error}</p>
      ) : (
        (turn.text || turn.streaming) && (
          <div className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
            {turn.text}
            {turn.streaming && <span className="animate-pulse">▍</span>}
          </div>
        )
      )}

      {turn.done && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-400">
          <span>{turn.cached ? "replayed" : turn.provider}</span>
          {!turn.cached && turn.model && <span>{turn.model}</span>}
          {typeof turn.ttftMs === "number" && <span>TTFT {turn.ttftMs}ms</span>}
          {typeof turn.totalMs === "number" && <span>total {turn.totalMs}ms</span>}
          <span>cost ${turn.costUsd?.toFixed(5) ?? "0"}</span>
        </div>
      )}
    </div>
  );
}
