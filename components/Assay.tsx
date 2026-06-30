"use client";

import { useId, useState } from "react";

/**
 * The Assay — the signature hero. A similarity axis with two REAL specimen pairs
 * (observed cosines against the live text-embedding-3-small): a legitimate
 * paraphrase at 0.919 that SHOULD be reused, and an inverted negation at 0.928
 * that must NOT be — the wrong one scores *higher*. Drag the τ threshold and see
 * the trap: no fixed cut keeps the paraphrase while rejecting the negation. The
 * guard does both.
 *
 * Static-first: the server/no-JS/reduced-motion state renders the full figure at
 * the shipped τ = 0.92 (the champion specimen). The slider is a progressive
 * enhancement — discrete state, keyboard + touch native, no animation loop.
 */

type Specimen = {
  id: string;
  cached: string;
  probe: string;
  cosine: number;
  equivalent: boolean;
  gist: string;
};

// Observed live (τ = 0.92, text-embedding-3-small) — see the playground.
const SPECIMENS: Specimen[] = [
  {
    id: "paraphrase",
    cached: "What is the capital of France?",
    probe: "Which city is the capital of France?",
    cosine: 0.919,
    equivalent: true,
    gist: "same answer — safe to reuse",
  },
  {
    id: "negation",
    cached: "Is coffee good for your health?",
    probe: "Is coffee bad for your health?",
    cosine: 0.928,
    equivalent: false,
    gist: "opposite answer — must not reuse",
  },
];

const LO = 0.88;
const HI = 0.96;
const pct = (c: number) => Math.max(0, Math.min(1, (c - LO) / (HI - LO))) * 100;

type Verdict = "kept" | "blocked" | "below";
function verdictOf(s: Specimen, tau: number): Verdict {
  if (s.cosine < tau) return "below";
  return s.equivalent ? "kept" : "blocked";
}

export function Assay() {
  // Default below both specimen cosines, so the figure opens on the clean
  // contrast: the paraphrase sealed, the near-twin negation struck. Drag it up
  // past 0.919 to watch the trap — you lose the paraphrase before the negation.
  const [tau, setTau] = useState(0.905);
  const sliderId = useId();

  // The pedagogical state: by THRESHOLD ALONE, would this τ keep the paraphrase
  // and reject the negation? Never — the negation scores higher than the paraphrase.
  const para = SPECIMENS[0]!;
  const neg = SPECIMENS[1]!;
  const note =
    tau <= para.cosine
      ? "Both clear τ — a threshold alone would serve the negation a wrong cached answer."
      : tau <= neg.cosine
        ? "τ now rejects the valid paraphrase, yet the negation still clears — strictly worse."
        : "τ rejects both — you've thrown away the paraphrase just to stop the negation.";

  return (
    <figure className="not-prose overflow-hidden rounded-2xl border border-line-strong bg-paper-raised">
      <div className="flex items-center justify-between border-b border-line-strong bg-paper-sunken/60 px-5 py-3">
        <span className="eyebrow">The assay · cosine vs. intent</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-faint">
          live embeddings
        </span>
      </div>

      <div className="p-5 sm:p-7">
        {/* Similarity axis */}
        <div className="flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-faint">
          <span>cosine similarity →</span>
          <span className="text-accent">
            τ = <span className="tabular-nums text-accent-strong">{tau.toFixed(3)}</span>
          </span>
        </div>

        <div className="relative mt-7 mb-9 h-px bg-line-strong">
          {/* τ threshold line */}
          <div
            className="absolute -top-3 bottom-[-0.75rem] w-px bg-accent"
            style={{ left: `${pct(tau)}%` }}
            aria-hidden
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[0.58rem] text-accent">
              τ
            </span>
          </div>

          {/* specimen markers */}
          {SPECIMENS.map((s, i) => {
            const v = verdictOf(s, tau);
            const above = i === 0; // paraphrase label above, negation below — never collide
            return (
              <div
                key={s.id}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pct(s.cosine)}%` }}
              >
                <span
                  className={
                    "block h-2.5 w-2.5 rounded-full ring-2 ring-paper-raised " +
                    (v === "kept"
                      ? "bg-accent"
                      : v === "blocked"
                        ? "bg-ink"
                        : "bg-ink-faint")
                  }
                  aria-hidden
                />
                <span
                  className={
                    "absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.58rem] tabular-nums " +
                    (above ? "bottom-4" : "top-4") +
                    (v === "kept"
                      ? " text-accent-strong"
                      : v === "blocked"
                        ? " text-ink"
                        : " text-ink-faint")
                  }
                >
                  {s.cosine.toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>

        {/* τ scrubber */}
        <label htmlFor={sliderId} className="sr-only">
          Cache threshold τ
        </label>
        <input
          id={sliderId}
          type="range"
          min={LO}
          max={HI}
          step={0.001}
          value={tau}
          onChange={(e) => setTau(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line outline-none"
          style={{ accentColor: "var(--color-accent)" }}
          aria-valuetext={`threshold ${tau.toFixed(3)}`}
        />

        {/* Specimen verdicts */}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {SPECIMENS.map((s) => {
            const v = verdictOf(s, tau);
            return (
              <div
                key={s.id}
                className={
                  "rounded-xl border p-4 " +
                  (v === "blocked"
                    ? "border-accent bg-accent-soft/40"
                    : "border-line bg-paper")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-faint">
                    cos {s.cosine.toFixed(3)}
                  </span>
                  <VerdictTag verdict={v} />
                </div>
                <p className="mt-2 text-sm leading-snug text-ink-muted">
                  <span className="text-ink">{s.cached}</span>
                </p>
                <p
                  className={
                    "mt-1 text-sm leading-snug " +
                    (v === "blocked"
                      ? "text-ink-faint line-through decoration-accent decoration-2"
                      : "text-ink-muted")
                  }
                >
                  {s.probe}
                </p>
                <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-faint">
                  {s.gist}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-muted">
          <span className="text-ink">
            No threshold keeps the paraphrase and rejects the negation
          </span>{" "}
          — the negation embeds <em>closer</em> than the paraphrase. {note} The
          two-tier guard reads <span className="text-ink">intent</span>, not distance,
          so it keeps one and strikes the other.
        </p>
      </div>
    </figure>
  );
}

function VerdictTag({ verdict }: { verdict: Verdict }) {
  if (verdict === "kept") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-[0.08em] text-accent-strong">
        ✓ kept · reused
      </span>
    );
  }
  if (verdict === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-paper px-2.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-[0.08em] text-ink">
        ✕ blocked · guard
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
      below τ · miss
    </span>
  );
}
