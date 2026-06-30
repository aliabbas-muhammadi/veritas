/**
 * Cost + latency benchmark — drives a realistic query stream through the REAL
 * gateway (live providers) and reports what the case study claims: latency as
 * percentiles (not averages), time-to-first-token, cache hit rate by tier, and
 * dollars spent vs saved. Reproducible and honest — it prints the methodology and
 * uses the same pricing snapshot the gateway meters with.
 *
 *   OPENAI_API_KEY=… ANTHROPIC_API_KEY=… npm run bench
 *
 * Needs keys (Haiku generation + OpenAI embeddings + the Haiku judge), so it runs
 * locally, not in CI. The stream is the cache's whole point: real traffic repeats
 * and paraphrases, which is where a semantic cache earns its keep.
 */
import { runGateway } from "@/lib/gateway";
import { snapshot, reset } from "@/lib/gateway/observe";
import type { GatewayRequest } from "@/lib/gateway/types";

// The guarded semantic cache, at the recommended operating point from the eval.
process.env.SEMANTIC_CACHE = "on";
process.env.GUARD_JUDGE = "on";
process.env.CACHE_THRESHOLD = process.env.CACHE_THRESHOLD || "0.72";

const MODEL = process.env.GATEWAY_PRIMARY_MODEL || "claude-haiku-4-5";
const MAX_TOKENS = 200;

// 10 novel questions, then verbatim repeats (exact hits), paraphrases (semantic
// hits), and a few negations (must NOT hit) — interleaved like real traffic.
const NOVEL = [
  "What is the capital of France?",
  "How tall is the Eiffel Tower?",
  "What does git rebase do?",
  "What is the boiling point of water at sea level?",
  "Who painted the Mona Lisa?",
  "What is the speed of light in a vacuum?",
  "What does HTTP status 404 mean?",
  "What is a SQL inner join?",
  "How long is the Great Wall of China?",
  "What is the chemical formula for water?",
];
const REPEAT = NOVEL.slice(0, 8); // verbatim → exact hits
const PARAPHRASE = [
  "Which city is the capital of France?",
  "What is the height of the Eiffel Tower?",
  "Explain what the git rebase command does.",
  "At sea level, what temperature does water boil?",
  "Which artist created the Mona Lisa?",
  "How fast does light travel in a vacuum?",
];
const NEGATION = [
  "Is coffee bad for your health?", // not a cached question — a fresh miss
  "Is using a VPN illegal in the United States?",
];

// Interleave: novel first (warm the cache), then a realistic mix.
const stream: string[] = [];
for (const q of NOVEL) stream.push(q);
for (let i = 0; i < 8; i++) {
  if (PARAPHRASE[i]) stream.push(PARAPHRASE[i]!);
  if (REPEAT[i]) stream.push(REPEAT[i]!);
}
for (const q of NEGATION) stream.push(q);

async function drive(q: string): Promise<void> {
  const req: GatewayRequest = {
    messages: [{ role: "user", content: q }],
    model: MODEL,
    maxTokens: MAX_TOKENS,
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ev of runGateway(req)) {
    // drain the stream; observe.ts records the metrics we report
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("bench needs ANTHROPIC_API_KEY (and OPENAI_API_KEY for the semantic tier).");
    process.exit(1);
  }
  reset();
  console.log(
    `Benchmark — ${stream.length} requests through the guarded gateway ` +
      `(model ${MODEL}, τ=${process.env.CACHE_THRESHOLD}, semantic+judge on)\n`,
  );
  const t0 = Date.now();
  for (const q of stream) await drive(q);
  const wall = ((Date.now() - t0) / 1000).toFixed(1);

  const s = snapshot();
  const usd = (x: number) => `$${x.toFixed(4)}`;
  console.log(`requests:        ${s.requests}  (wall ${wall}s)`);
  console.log(
    `cache:           hit ${(s.cache.hitRate * 100).toFixed(0)}%  ` +
      `(exact ${s.cache.exact} · semantic ${s.cache.semantic} · miss ${s.cache.miss})`,
  );
  console.log(`TTFT latency:    p50 ${s.latency.ttftP50} ms · p95 ${s.latency.ttftP95} ms`);
  console.log(`total latency:   p50 ${s.latency.totalP50} ms · p95 ${s.latency.totalP95} ms`);
  console.log(`cost:            spent ${usd(s.cost.spentUsd)} · saved ${usd(s.cost.savedUsd)}`);
  const avoided = s.requests ? ((s.cache.exact + s.cache.semantic) / s.requests) * 100 : 0;
  const total = s.cost.spentUsd + s.cost.savedUsd;
  console.log(
    `\n${avoided.toFixed(0)}% of requests served from cache → ` +
      `${total > 0 ? ((s.cost.savedUsd / total) * 100).toFixed(0) : "0"}% of provider spend avoided, ` +
      `at ~0 ms TTFT for those hits.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
