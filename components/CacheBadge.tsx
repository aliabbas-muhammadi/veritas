import type { Turn } from "./gateway-client";

/**
 * The verdict pill for a turn — the single most important visual in the demo. It
 * makes the cache decision legible: a paraphrase HIT (free), a cold MISS, or the
 * money shot — a high-similarity candidate the guard *blocked*, which a fixed
 * threshold would have served as a wrong answer.
 */
export function CacheBadge({ turn }: { turn: Turn }) {
  const sim = (s?: number) => (typeof s === "number" ? s.toFixed(2) : "—");

  if (turn.streaming && !turn.cache) {
    return <Pill tone="muted">routing…</Pill>;
  }
  if (turn.error) {
    return <Pill tone="error">error</Pill>;
  }

  // A guard-blocked miss — the thesis made visible.
  if (turn.cache === "miss" && turn.guard) {
    const by = turn.guard.by === "judge" ? "LLM judge" : "keyless guard";
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Pill tone="block">
          guard blocked · sim {sim(turn.guard.similarity)}
        </Pill>
        <span className="font-mono text-[11px] text-amber-700 dark:text-amber-500">
          {by} · fresh answer served
        </span>
      </span>
    );
  }

  if (turn.cache === "exact") {
    return (
      <Pill tone="hit">
        exact HIT · tier-1 · $0
      </Pill>
    );
  }
  if (turn.cache === "semantic") {
    return (
      <Pill tone="hit">
        semantic HIT · sim {sim(turn.similarity)} · $0
      </Pill>
    );
  }

  // A plain miss (streamed from a provider).
  if (turn.cache === "miss") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Pill tone="miss">miss · streamed</Pill>
        {turn.rescued && (
          <Pill tone="rescue">failover → {turn.provider} · rescued</Pill>
        )}
      </span>
    );
  }
  return null;
}

type Tone = "hit" | "miss" | "block" | "rescue" | "error" | "muted";

const TONES: Record<Tone, string> = {
  hit: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  miss: "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
  block: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300",
  rescue: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300",
  error: "border-red-300 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300",
  muted: "border-zinc-200 bg-transparent text-zinc-400 dark:border-zinc-800 dark:text-zinc-500",
};

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
