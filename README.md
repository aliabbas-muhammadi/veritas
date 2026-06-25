# Veritas — an LLM gateway whose cache is proven correct

A provider-agnostic LLM gateway with a **two-tier semantic cache whose
false-positive rate is measured, not assumed.** The whole industry reports a
cache *hit rate*; almost nobody reports cache-hit *precision* — so a "90% hit
rate" can quietly include answers that are wrong. (GPTCache, for instance,
publishes hit-ratio and recall but no precision; it's structurally blind to the
worst failure.) Veritas scores the metric they omit and **gates CI on it**.

> **Status: P1–P4 — cache, guard, observability, and failover, all measured.** The repo runs green keyless (the
> eval prints the precision/false-positive table + threshold sweep and gates CI).
> The live pipeline is verified end-to-end: a paraphrase is served from cache, a
> near-identical *negation* is correctly blocked, and a forced outage fails over
> before the first token. Every number is real and reproducible via `npm run
> eval`, never a placeholder.

### Headline result (41 adversarial pairs, real `text-embedding-3-small`)

A fixed cosine threshold **cannot** separate correct paraphrase-hits from wrong
negation-hits — on real embeddings the negations score *higher* than the
legitimate paraphrases ("is coffee **bad**…" 0.93 / "is medication **unsafe**…"
0.95 vs paraphrases 0.81–0.90). So the naive semantic cache at τ=0.92 has a **50%
false-positive rate** — it serves the wrong answer half the times it fires.

The two-tier guard fixes it, and the lift is measured:

| pipeline (τ=0.92) | precision | recall | FP rate |
| --- | --- | --- | --- |
| +semantic (naive) | 0.37 | 0.41 | **50%** |
| + deterministic guard (keyless) | 0.70 | 0.41 | 12.5% |
| **+ Haiku intent judge (shipped)** | **1.00** | 0.41 | **0%** |

And the guard **dominates the whole curve** — precision 1.00 / FP 0% at *every*
threshold — so you can lower τ to **0.78 for recall 0.82 at FP 0%**, where the raw
cache's FP rate is 83%. (The raw cache only reaches FP 0% at τ=0.96, where recall
collapses to 0.35.) The deterministic tier catches lexical flips for free
(good/bad, legal/illegal, today/tomorrow, 2023/2024); the Haiku judge catches the
semantic ones it can't ("avoid learning X", swapped unit conversions). This is the
vCache / MeanCache finding reproduced on our own data — and the guard that answers it.

## Why this matters

A semantic cache turns a paraphrase ("what's the capital of France?" →
"which city is France's capital?") into a free, instant answer. But two questions
can embed *close* yet need *opposite* answers — the classic being negation
("is X safe?" vs "is X **not** safe?"). A cache that fires on that serves a
confident, wrong, cached answer. The only honest way to ship one is to **measure
how often it does that** and refuse to ship if it's too often.

- **Two-tier cache.** Tier-1 exact match on a *scoped* hash (system + query +
  model + sampling params) — 100% precise, free. Tier-2 embedding cosine for
  paraphrases — where false positives live.
- **An adversarial eval.** A labeled golden set of pairs: paraphrases that
  *should* hit, and negation / different-answer / scope-flip pairs that *must
  not*. The harness reports precision, recall, and **false-positive rate** of
  cache hits, sweeps a precision-recall curve across thresholds, and gates CI.
- **Measured guards (P2+).** A rerank guard confirms intent on the top semantic
  candidate; scope isolation refuses cross-scope hits. Each guard's precision
  lift is measured, not asserted.
- **Provider-agnostic.** One normalized stream over Anthropic + OpenAI (raw
  HTTP, no SDK lock-in), with a deterministic offline mock so it runs — and the
  demo stays nearly free — with no keys.

## Architecture

```
client → /api/chat (NDJSON stream)
  scopeKey  → cache.lookup:  Tier-1 EXACT ─hit─┐ (free)
                             Tier-2 SEMANTIC cosine ≥ τ → [P2 guard] ─hit─┤
                                                                          │
              miss → provider (anthropic → openai → mock) → stream ───────┤→ cache.put
                                                                          │
  observe (P3): gen_ai.* — TTFT, p50/p95, cache hit rate, $ saved, FP rate
```

## Eval — the centerpiece

```
npm run eval        # keyless: scores cache-hit precision / recall / FP rate,
                    # sweeps a PR curve, and FAILS the build if the shipped
                    # pipeline's FP rate exceeds FP_BUDGET (the inverse of a
                    # RAG recall gate — don't serve wrong cached answers).
```

| metric | meaning | status |
| --- | --- | --- |
| cache-hit precision | of hits served, how many were correct | +semantic 0.37 → **+guard 1.00** (τ=0.92) |
| **false-positive rate** | how often a wrong cached answer is served | +semantic 50% → **+guard 0%** (τ=0.92) |
| rerank-guard lift | precision before → after the guard | 0.37 → 0.70 (det) → **1.00** (judge) |
| p50/p95 latency · TTFT | streaming responsiveness | live: TTFT p50 ~1.0s · cache replay ~0 ms |
| demo cost | cache hit = $0; a Haiku miss ≈ $0.001–0.003 | live `/api/metrics`: $ spent ≈ $ saved |
| failover rescued rate | outages caught before the first token | live: provider outage → served by fallback |

_Measured on the 41-pair adversarial set (`eval/golden.json`), real OpenAI embeddings._

## Build phases

- **Scaffold (done):** repo, types, two-tier cache (exact tier live, semantic
  off behind the guard), mock + live providers, eval harness + seed golden set,
  keyless CI gate.
- **P1 (done):** real OpenAI embeddings (`npm run embed:golden`); exact-only vs
  +semantic precision/recall measured; live pipeline verified end-to-end.
- **P2 (done):** 41-pair adversarial golden set + two-tier rerank guard
  (deterministic + Haiku judge); measured precision lift 0.37 → 1.00 at FP 0%; CI
  gate flipped to the guarded semantic arm; live guard verified.
- **P3 (done):** observability — OpenTelemetry `gen_ai.*` events in an in-memory
  ring, `GET /api/metrics` with hit-rate by tier, TTFT/total **percentiles**,
  `$ spent` and `$ saved`, and the failover-rescued rate (cost from a dated
  `data/pricing.json` snapshot, so the figures are honest estimates).
- **P4 (done):** resilience — circuit breaker + **pre-first-token failover**
  (`establishStream` commits to a provider only once it yields its first event;
  a failure before that is a rescue, after it is surfaced as partial + error — the
  mid-stream wall, documented not faked). Plus a deliberately minimal, **off-by-
  default** router framed honestly against RouterArena (no unmeasured "beats X"
  claim — a routing-quality eval is the bar, and it's future work).
- **P6:** the interactive playground; deploy to `gateway.alimuhammadi.com`.

## Run

```
npm install
npm run embed:golden     # builds data/golden-embeddings.json (uses OPENAI_API_KEY
                         # if set; otherwise a deterministic local bootstrap)
npm run judge:golden     # builds data/golden-guard.json (Haiku intent verdicts;
                         # ANTHROPIC_API_KEY for the full guard, else Tier-A only)
npm run eval             # prints the precision/FP table + threshold sweep, gates CI
npm run dev              # POST /api/chat — streams NDJSON (mock provider if no keys)
```

With no API keys the gateway serves a deterministic mock answer and the eval runs
off committed embeddings — so `build`, `lint`, and `eval` are all green keyless,
exactly what CI runs. Add `ANTHROPIC_API_KEY` (primary) and/or `OPENAI_API_KEY`
(embeddings + fallback) for the live pipeline.

## License

Proprietary — published for reference and review only. See `LICENSE`.
