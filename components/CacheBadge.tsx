import type { Turn } from "./gateway-client";

/**
 * The verdict pill for a turn — the single most important visual in the demo.
 * Color is collapsed to ONE accent (manuscript verdigris) plus ink, so the guard
 * "money shot" finally outranks every routine hit/miss: a kept hit is a quiet
 * verdigris seal, a miss recedes to ink, and a guard-BLOCKED near-twin is the
 * boldest mark on the card — accent-ringed, the cached answer struck through.
 * Red is reserved strictly for genuine errors.
 */
export function CacheBadge({ turn }: { turn: Turn }) {
  const sim = (s?: number) => (typeof s === "number" ? s.toFixed(2) : "—");

  if (turn.streaming && !turn.cache) {
    return <Pill tone="muted">routing…</Pill>;
  }
  if (turn.error) {
    return <Pill tone="error">error</Pill>;
  }

  // A guard-blocked miss — the thesis made visible. The boldest verdict here.
  if (turn.cache === "miss" && turn.guard) {
    const by = turn.guard.by === "judge" ? "LLM judge" : "keyless guard";
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Pill tone="block">✕ guard blocked · cos {sim(turn.guard.similarity)}</Pill>
        <span className="font-mono text-[11px] text-ink-faint">
          {by} · fresh answer served
        </span>
      </span>
    );
  }

  if (turn.cache === "exact") {
    return <Pill tone="hit">✓ exact hit · tier-1 · $0</Pill>;
  }
  if (turn.cache === "semantic") {
    return <Pill tone="hit">✓ semantic hit · cos {sim(turn.similarity)} · $0</Pill>;
  }

  // A plain miss (streamed from a provider).
  if (turn.cache === "miss") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Pill tone="miss">miss · streamed</Pill>
        {turn.rescued && <Pill tone="rescue">failover → {turn.provider} · rescued</Pill>}
      </span>
    );
  }
  return null;
}

type Tone = "hit" | "miss" | "block" | "rescue" | "error" | "muted";

const TONES: Record<Tone, string> = {
  // A quiet verdigris seal.
  hit: "border-accent/40 bg-accent-soft text-accent-strong",
  // Recedes — a miss is unremarkable.
  miss: "border-line bg-paper text-ink-faint",
  // The money shot: accent-ringed on paper, the boldest mark.
  block: "border-accent bg-paper text-ink ring-1 ring-accent/30",
  // Resilience: an accent outline, distinct from the filled hit.
  rescue: "border-accent/40 bg-paper text-accent-strong",
  // The only non-teal — reserved for genuine errors.
  error: "border-red-400/40 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300",
  muted: "border-line bg-transparent text-ink-faint",
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
