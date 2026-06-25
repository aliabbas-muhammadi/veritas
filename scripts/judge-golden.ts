/**
 * Precompute the intent-guard decision for every golden pair and commit it to
 * data/golden-guard.json — so eval/run.ts can score the guarded cache (incl. the
 * LLM-judge tier) deterministically in keyless CI, the same way committed
 * embeddings let the semantic arm run without a key.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run judge:golden   # full guard (Tier A + Haiku)
 *   npm run judge:golden                                 # Tier A only (deterministic)
 *
 * Re-run this after editing eval/golden.json. The judge is run at temperature 0,
 * so the verdicts are stable and reproducible.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deterministicReject, llmJudgeGuard, judgeAvailable } from "@/lib/gateway/rerank";

type GoldenItem = { id: string; base: string; probe: string };
type Verdict = { keep: boolean; det: boolean };

async function main() {
  const golden = JSON.parse(
    readFileSync(join(process.cwd(), "eval", "golden.json"), "utf8"),
  ) as GoldenItem[];

  const withJudge = judgeAvailable();
  const verdicts: Record<string, Verdict> = {};

  for (const g of golden) {
    const det = deterministicReject(g.base, g.probe);
    // Full guard: Tier A rejects ⇒ keep=false; else Tier B (judge) decides.
    const keep = det ? false : await llmJudgeGuard(g.base, g.probe);
    verdicts[g.id] = { keep, det };
  }

  const model = withJudge
    ? `det + judge:${process.env.GUARD_JUDGE_MODEL || process.env.GATEWAY_PRIMARY_MODEL || "claude-haiku-4-5"}`
    : "det-only (no ANTHROPIC_API_KEY)";

  writeFileSync(
    join(process.cwd(), "data", "golden-guard.json"),
    JSON.stringify({ model, count: golden.length, verdicts }) + "\n",
  );
  if (!withJudge) {
    console.warn("No ANTHROPIC_API_KEY — wrote DETERMINISTIC-ONLY guard verdicts (Tier A).");
  }
  console.log(`Wrote ${golden.length} guard verdicts (${model}) → data/golden-guard.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
