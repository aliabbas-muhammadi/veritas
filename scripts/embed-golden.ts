/**
 * Precompute embeddings for every base/probe string in eval/golden.json and
 * write data/golden-embeddings.json (id -> vector). This is the keyless-CI trick
 * from the flagship: commit the vectors so eval/run.ts scores the semantic cache
 * deterministically with NO API key.
 *
 *   OPENAI_API_KEY=sk-... npm run embed:golden   # real OpenAI embeddings (use this)
 *   npm run embed:golden                          # deterministic LOCAL fallback
 *
 * The LOCAL fallback (hashed character trigrams) exists ONLY to bootstrap the
 * scaffold before a key is available: it's a real, deterministic, keyless
 * embedder, but it's a weak *lexical* one — it cannot tell "is X safe" from
 * "is X NOT safe" apart (they share almost every trigram), which is exactly why
 * the eval's informational +semantic arm shows false positives on negation until
 * real embeddings + the P2 guard land. Re-run with OPENAI_API_KEY for the real
 * numbers; the committed file's `model` field records which embedder was used.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OPENAI_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const LOCAL_DIM = 256;
const round = (v: number) => Math.round(v * 1e6) / 1e6;

type GoldenItem = { id: string; base: string; probe: string };

// ── Local deterministic fallback: L2-normalized hashed character-trigram TF ──
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function localEmbed(text: string, dim = LOCAL_DIM): number[] {
  const v = new Array<number>(dim).fill(0);
  const s = ` ${text.toLowerCase().replace(/\s+/g, " ").trim()} `;
  for (let i = 0; i + 3 <= s.length; i++) {
    v[fnv1a(s.slice(i, i + 3)) % dim] += 1;
  }
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map((x) => x / norm);
}

async function openaiEmbed(inputs: string[], key: string): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, input: inputs }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

async function main() {
  const goldenPath = join(process.cwd(), "eval", "golden.json");
  const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as GoldenItem[];

  // Flatten to (key, text) pairs: "<id>:base" and "<id>:probe".
  const entries: { key: string; text: string }[] = [];
  for (const g of golden) {
    entries.push({ key: `${g.id}:base`, text: g.base });
    entries.push({ key: `${g.id}:probe`, text: g.probe });
  }

  const key = process.env.OPENAI_API_KEY;
  const vectors: Record<string, number[]> = {};
  let model: string;

  if (key) {
    model = `openai:${OPENAI_MODEL}`;
    const embs = await openaiEmbed(
      entries.map((e) => e.text),
      key,
    );
    entries.forEach((e, i) => {
      vectors[e.key] = embs[i]!.map(round);
    });
  } else {
    model = `local:trigram-hash-${LOCAL_DIM}`;
    for (const e of entries) vectors[e.key] = localEmbed(e.text).map(round);
    console.warn(
      "No OPENAI_API_KEY — wrote DETERMINISTIC LOCAL placeholder embeddings.\n" +
        "These bootstrap the scaffold; re-run with a key for the real numbers.",
    );
  }

  const dim = Object.values(vectors)[0]?.length ?? 0;
  const outPath = join(process.cwd(), "data", "golden-embeddings.json");
  writeFileSync(outPath, JSON.stringify({ model, dim, vectors }) + "\n");
  console.log(
    `Wrote ${Object.keys(vectors).length} vectors (${dim}-d, ${model}) → data/golden-embeddings.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
