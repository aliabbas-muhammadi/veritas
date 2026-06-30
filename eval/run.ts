/**
 * Cache-correctness eval — the centerpiece.
 *
 *   npm run eval                 # scores the cache-hit decision over committed
 *                                # embeddings + guard verdicts (keyless, gates CI)
 *
 * The whole industry reports a cache HIT RATE; almost nobody reports cache-hit
 * PRECISION, so a "90% hit rate" can quietly include answers that are wrong
 * (GPTCache, e.g., publishes hit-ratio and recall but no precision). This harness
 * scores the metric they omit:
 *
 *   TP  hit  & answers are equivalent     (a correct, money-saving hit)
 *   FP  hit  & answers DIFFER             (served a semantically-WRONG answer) ← the headline
 *   FN  miss & answers are equivalent     (a recoverable cost miss)
 *   TN  miss & answers DIFFER             (a correct refusal)
 *
 *   precision = TP/(TP+FP)    recall = TP/(TP+FN)    FP rate = FP/(FP+TN)
 *
 * The CI gate is the INVERSE of a RAG recall gate: it fails the build if the
 * SHIPPED pipeline's false-positive rate exceeds FP_BUDGET.
 *
 * Arms (each adds one guard to the raw semantic tier):
 *   exact-only    Tier-1 scoped-hash match only.
 *   +semantic(τ)  add Tier-2 cosine ≥ τ — the naive cache. Where FPs come from.
 *   +detguard     + deterministic polarity/scope guard (keyless, cheap).
 *   +llmguard     + Haiku intent judge (committed verdicts) — the shipped pipeline.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import golden from "./golden.json";
import index from "@/data/golden-embeddings.json";
import { cosine } from "@/lib/gateway/similarity";
import { canonical } from "@/lib/gateway/scopeKey";
import { deterministicReject } from "@/lib/gateway/rerank";
import { looProbs } from "@/lib/gateway/boundary";

type PairType =
  | "exact-repeat"
  | "paraphrase-should-hit"
  | "different-answer-must-not-hit"
  | "negation-must-not-hit";

type GoldenItem = {
  id: string;
  group: string;
  base: string;
  probe: string;
  pairType: PairType;
  equivalent: boolean;
  note?: string;
};

type EmbIndex = { model: string; dim: number; vectors: Record<string, number[]> };
type GuardFile = { model: string; verdicts: Record<string, { keep: boolean; det: boolean }> };

const items = golden as GoldenItem[];
const emb = index as EmbIndex;

const guardPath = join(process.cwd(), "data", "golden-guard.json");
const guard: GuardFile | null = existsSync(guardPath)
  ? (JSON.parse(readFileSync(guardPath, "utf8")) as GuardFile)
  : null;

const OPERATING_TAU = Number(process.env.CACHE_THRESHOLD ?? "0.92");
const FP_BUDGET = Number(process.env.FP_BUDGET ?? "0.02");
const PRECISION_GATE = Number(process.env.PRECISION_GATE ?? "0.95");

function vec(key: string): number[] {
  const v = emb.vectors[key];
  if (!v) throw new Error(`missing embedding "${key}" — run \`npm run embed:golden\`.`);
  return v;
}

// ── Decision predicates ─────────────────────────────────────────────────────
const exactHit = (it: GoldenItem) => canonical(it.base) === canonical(it.probe);
const semSim = (it: GoldenItem) => cosine(vec(`${it.id}:base`), vec(`${it.id}:probe`));
const detKeep = (it: GoldenItem) => !deterministicReject(it.base, it.probe);
function guardKeep(it: GoldenItem): boolean {
  if (!guard) return true;
  const v = guard.verdicts[it.id];
  if (!v) throw new Error(`missing guard verdict for "${it.id}" — run \`npm run judge:golden\`.`);
  return v.keep;
}

type Arm = (it: GoldenItem) => boolean;
const armExact: Arm = (it) => exactHit(it);
const armSemantic = (tau: number): Arm => (it) => exactHit(it) || semSim(it) >= tau;
const armDetGuard = (tau: number): Arm => (it) => exactHit(it) || (semSim(it) >= tau && detKeep(it));
const armLlmGuard = (tau: number): Arm => (it) => exactHit(it) || (semSim(it) >= tau && guardKeep(it));

// ── Metrics ──────────────────────────────────────────────────────────────────
type Metrics = { tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; fpRate: number; hitRate: number };

function score(hit: Arm): Metrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const it of items) {
    const h = hit(it);
    if (h && it.equivalent) tp++;
    else if (h && !it.equivalent) fp++;
    else if (!h && it.equivalent) fn++;
    else tn++;
  }
  return {
    tp, fp, fn, tn,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: tp + fn ? tp / (tp + fn) : 1,
    fpRate: fp + tn ? fp / (fp + tn) : 0,
    hitRate: (tp + fp) / items.length,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const f3 = (x: number) => x.toFixed(3);
function printArm(label: string, m: Metrics) {
  console.log(
    `${label.padEnd(16)} P=${f3(m.precision)}  R=${f3(m.recall)}  FP=${pct(m.fpRate).padStart(6)}  ` +
      `hit=${pct(m.hitRate).padStart(6)}  [TP ${m.tp} · FP ${m.fp} · FN ${m.fn} · TN ${m.tn}]`,
  );
}

function main() {
  console.log("Veritas — cache-correctness eval");
  console.log(
    `embeddings: ${emb.model} (${emb.dim}-d) · guard: ${guard ? guard.model : "none"} · pairs: ${items.length}`,
  );
  if (emb.model.startsWith("local:")) {
    console.log("⚠ PLACEHOLDER embeddings — run `OPENAI_API_KEY=… npm run embed:golden` for real numbers.");
  }

  const exact = score(armExact);
  const semantic = score(armSemantic(OPERATING_TAU));
  const det = score(armDetGuard(OPERATING_TAU));
  const llm = guard ? score(armLlmGuard(OPERATING_TAU)) : null;

  console.log(`\nArms (operating τ=${OPERATING_TAU}) — ${items.length} pairs`);
  console.log("-".repeat(82));
  printArm("exact-only", exact);
  printArm("+semantic", semantic);
  printArm("+detguard", det);
  if (llm) printArm("+llmguard", llm);
  console.log("-".repeat(82));

  // The headline: precision lift as each guard is added.
  const lift = llm
    ? `${f3(semantic.precision)} → ${f3(det.precision)} (det) → ${f3(llm.precision)} (full guard)`
    : `${f3(semantic.precision)} → ${f3(det.precision)} (det)  [run judge:golden for the LLM-guard arm]`;
  console.log(`Precision lift (semantic → guarded): ${lift}`);
  if (llm) {
    console.log(
      `Recall held: ${f3(semantic.recall)} → ${f3(llm.recall)}   ·   ` +
        `FP rate: ${pct(semantic.fpRate)} → ${pct(llm.fpRate)}`,
    );
  }

  // ── Candidate-level verdicts: where each guard tier earns its keep ─────────
  const shown = items.filter((it) => exactHit(it) || semSim(it) >= OPERATING_TAU);
  console.log(`\nCache candidates at τ=${OPERATING_TAU} (cosine ≥ τ or exact) — what each guard does`);
  console.log("-".repeat(82));
  for (const it of shown) {
    const sim = exactHit(it) ? 1 : semSim(it);
    const dRej = deterministicReject(it.base, it.probe);
    const gKeep = guard ? guardKeep(it) : !dRej;
    const finalHit = exactHit(it) || (sim >= OPERATING_TAU && gKeep);
    const correct = finalHit === it.equivalent;
    const caught =
      !it.equivalent && !finalHit ? (dRej ? "det✓" : "judge✓") : it.equivalent && finalHit ? "kept✓" : "";
    const verdict = finalHit
      ? it.equivalent
        ? "HIT ✓"
        : "HIT ✗ FALSE POSITIVE"
      : it.equivalent
        ? "miss (recall loss)"
        : "blocked";
    console.log(
      `${correct ? " " : "✗"} sim=${f3(sim)} ${it.pairType.padEnd(30)} ${verdict.padEnd(20)} ${caught.padEnd(7)} ${it.probe}`,
    );
  }

  // ── Threshold sweep: raw +semantic vs +llmguard, across τ ─────────────────
  // The guard's real value: it dominates the whole curve, so you can LOWER τ to
  // recover recall while FP stays ≈0 — where the raw cache is unsafe at any τ.
  console.log(`\nThreshold sweep — raw +semantic vs guarded, across τ`);
  console.log("-".repeat(82));
  console.log("   τ      raw:  P      R      FP        guarded:  P      R      FP");
  let bestTau: number | null = null;
  let bestRecall = -1;
  // Pick the HIGHEST τ that still reaches the max safe recall — same recall, fewest
  // judge calls (lower τ only floods the judge with more near-threshold candidates).
  for (let t = 0.68; t <= 0.97001; t += 0.02) {
    const tau = Math.round(t * 100) / 100;
    const raw = score(armSemantic(tau));
    const g = guard ? score(armLlmGuard(tau)) : null;
    if (g && g.fpRate <= FP_BUDGET && g.recall >= bestRecall) {
      bestRecall = g.recall;
      bestTau = tau;
    }
    const gcol = g ? `${f3(g.precision)}  ${f3(g.recall)}  ${pct(g.fpRate).padStart(6)}` : "—";
    console.log(
      `  ${tau.toFixed(2)}       ${f3(raw.precision)}  ${f3(raw.recall)}  ${pct(raw.fpRate).padStart(6)}` +
        `            ${gcol}`,
    );
  }
  console.log("-".repeat(82));
  if (bestTau !== null) {
    console.log(
      `The guard lets you operate at τ=${bestTau.toFixed(2)}: guarded recall ${f3(bestRecall)} at FP ≤ ${pct(FP_BUDGET)}, ` +
        `where the raw cache's FP rate is far higher. No fixed τ makes the RAW cache both safe and high-recall.`,
    );
  }

  // ── Learned-threshold experiment (vCache-style, leave-one-out) ────────────
  // Can a judge-free LEARNED decision match the judge? Fit a tiny logistic
  // regression on cheap features, graded leave-one-out (no row sees itself), and
  // pick the lowest probability cutoff meeting the FP budget (max recall).
  function armFromProbs(prob: number[], cut: number): Metrics {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    items.forEach((it, i) => {
      const h = exactHit(it) || prob[i]! >= cut;
      if (h && it.equivalent) tp++;
      else if (h && !it.equivalent) fp++;
      else if (!h && it.equivalent) fn++;
      else tn++;
    });
    return {
      tp, fp, fn, tn,
      precision: tp + fp ? tp / (tp + fp) : 1,
      recall: tp + fn ? tp / (tp + fn) : 1,
      fpRate: fp + tn ? fp / (fp + tn) : 0,
      hitRate: (tp + fp) / items.length,
    };
  }
  function bestCut(prob: number[]): Metrics {
    let best: Metrics | null = null;
    for (let c = 0.05; c <= 0.95001; c += 0.025) {
      const m = armFromProbs(prob, c);
      if (m.fpRate <= FP_BUDGET && (!best || m.recall > best.recall)) best = m;
    }
    return best ?? armFromProbs(prob, 0.95);
  }
  const yLab = items.map((it) => (it.equivalent ? 1 : 0));
  const learnedSim = bestCut(looProbs(items.map((it) => [semSim(it)]), yLab));
  const learnedDet = bestCut(looProbs(items.map((it) => [semSim(it), deterministicReject(it.base, it.probe) ? 1 : 0]), yLab));
  let fixedRecallAtBudget = 0;
  for (let t = 0.7; t <= 0.99001; t += 0.01) {
    const m = score(armSemantic(Math.round(t * 100) / 100));
    if (m.fpRate <= FP_BUDGET) fixedRecallAtBudget = Math.max(fixedRecallAtBudget, m.recall);
  }
  console.log(`\nLearned-threshold experiment (logistic, leave-one-out) — judge-free?`);
  console.log("-".repeat(82));
  console.log(`fixed-τ (sim only)  best recall ${f3(fixedRecallAtBudget)} at FP ≤ ${pct(FP_BUDGET)}`);
  printArm("learned: sim", learnedSim);
  printArm("learned: sim+det", learnedDet);
  console.log("-".repeat(82));
  console.log(
    `No threshold — fixed OR learned on cheap features — beats recall ~${f3(fixedRecallAtBudget)} at FP ≤ ${pct(FP_BUDGET)}: the\n` +
      `decision is monotonic in cosine and negations outscore paraphrases, so a judge-free cut has nothing to learn.\n` +
      (bestTau !== null
        ? `The LLM-judge guard recovers recall to ${f3(bestRecall)} at the same FP budget (operating at τ=${bestTau.toFixed(2)}) — it\n` +
          `accepts true paraphrases at LOW similarity that any threshold rejects, while still blocking the\n` +
          `high-similarity negations. That ${(bestRecall / Math.max(fixedRecallAtBudget, 0.001)).toFixed(1)}× recall gap is the judge's measured, irreplaceable value.`
        : ``),
  );

  // ── The gate ───────────────────────────────────────────────────────────────
  const arms: Record<string, Metrics | null> = { exact, semantic, detguard: det, llmguard: llm };
  const requested = process.env.GATE_ARM;
  let gateArm = requested ?? (guard ? "llmguard" : "exact");
  if (gateArm === "llmguard" && !guard) {
    console.log("\n(no committed guard verdicts — gating exact-only; run `npm run judge:golden`.)");
    gateArm = "exact";
  }
  const gated = arms[gateArm];
  if (!gated) throw new Error(`unknown GATE_ARM "${gateArm}"`);

  console.log(`\nGate (arm=${gateArm}${gateArm === "llmguard" ? " — shipped pipeline" : ""})`);
  console.log(
    `  FP rate ${f3(gated.fpRate)} vs budget ${f3(FP_BUDGET)} · ` +
      `precision ${f3(gated.precision)} vs gate ${f3(PRECISION_GATE)} · recall ${f3(gated.recall)}`,
  );
  if (gated.fpRate > FP_BUDGET || gated.precision < PRECISION_GATE) {
    console.error("FAIL: pipeline would serve wrong cached answers above the FP budget.");
    process.exit(1);
  }
  console.log("PASS");
}

main();
