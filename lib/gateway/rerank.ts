/**
 * The intent guard — the difference between a cache *hit rate* and a *correct*
 * hit rate. It runs on the top semantic candidate (after cosine ≥ τ) and decides
 * whether the two questions truly share an answer. Two tiers, mirroring a
 * cheap-linter-then-LLM-fidelity-pass:
 *
 *   Tier A  deterministicReject()  keyless, O(1). Catches the lexical flips that
 *           fool cosine: negation-parity, antonym pairs, scope-member swaps,
 *           number mismatches. High precision at rejecting — it only fires when
 *           it is confident the intent flipped.
 *   Tier B  llmJudgeGuard()        a Haiku judge confirms intent equivalence on
 *           whatever survives Tier A. Catches the SEMANTIC flips Tier A can't see
 *           ("avoid learning X", "wait before investing", swapped conversions).
 *
 * A Tier-A reject is FINAL — the judge only ever sees hits Tier A passes — so
 * Tier A is deliberately limited to high-confidence flips (antonyms, scope
 * members, number mismatches, plain "not"/"never") that essentially never fire
 * on a genuine paraphrase. Ambiguous negation words that DO appear in benign
 * paraphrases ("...without medication" ≈ "drug-free...") are intentionally left
 * out of Tier A and owned by the judge.
 */

// ── Tier A: deterministic, keyless ──────────────────────────────────────────

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

function numberSet(s: string): Set<string> {
  return new Set(s.match(/\d+(?:\.\d+)?/g) ?? []);
}

// Deliberately excludes "without" / "cannot" / "can't": those appear in benign
// paraphrases ("fall asleep WITHOUT medication" ≈ "drug-free ways to sleep";
// "why CAN'T I log in" ≈ "why am I unable to log in"), so hard-rejecting on them
// over-blocks. Plain syntactic negation ("not", "never") and the semantic flips
// they miss are left to the LLM judge — which is the authority.
const NEGATION_CUES = new Set([
  "not", "no", "never", "none", "neither", "nor",
  "isn't", "aren't", "don't", "doesn't", "didn't", "won't",
  "shouldn't", "wouldn't", "couldn't", "wasn't", "weren't",
  // apostrophe-less variants (typos / OCR) — adding cues only makes Tier A more
  // conservative, and false rejections are already owned by the judge.
  "isnt", "arent", "dont", "doesnt", "didnt", "wont",
  "shouldnt", "wouldnt", "couldnt", "wasnt", "werent",
]);

/** Opposite poles: a flip = one text touches side A, the other side B. */
const OPPOSITES: [string[], string[]][] = [
  [["good"], ["bad"]],
  [["safe"], ["unsafe", "dangerous"]],
  [["legal"], ["illegal"]],
  [["healthy"], ["unhealthy"]],
  [["true"], ["false"]],
  [["up"], ["down"]],
  [["open"], ["closed", "close"]],
  [["raise", "raises", "increase", "increases", "higher", "rise"], ["lower", "lowers", "decrease", "decreases", "reduce", "fall"]],
  [["allowed", "permitted"], ["prohibited", "banned", "forbidden"]],
  [["effective"], ["ineffective"]],
  [["include", "includes", "including"], ["exclude", "excludes", "excluding"]],
  [["compiled"], ["interpreted"]],
  [["enable", "enabled"], ["disable", "disabled"]],
  [["valid"], ["invalid"]],
];

/** Mutually-exclusive scope members: a flip = different members of one class. */
const SCOPE_CLASSES: string[][] = [
  ["today", "tomorrow", "yesterday", "tonight"],
  ["child", "children", "kid", "kids", "infant", "infants", "baby", "toddler", "adult", "adults", "teen", "teenager", "elderly", "senior", "seniors"],
  ["celsius", "fahrenheit", "kelvin"],
  ["km", "kilometer", "kilometers", "kilometre", "kilometres", "mile", "miles", "meter", "meters", "metre", "metres", "feet", "foot"],
  ["soccer", "basketball", "baseball", "football", "hockey", "tennis", "cricket", "rugby"],
];

const touches = (set: Set<string>, words: string[]) => words.some((w) => set.has(w));
const members = (set: Set<string>, words: string[]) => words.filter((w) => set.has(w)).sort().join(",");

/** True ⇒ the two queries confidently differ in intent; the hit must be rejected. */
export function deterministicReject(a: string, b: string): boolean {
  const ta = tokenSet(a);
  const tb = tokenSet(b);

  // Negation parity: one query carries a negation cue the other lacks.
  for (const cue of NEGATION_CUES) {
    if (ta.has(cue) !== tb.has(cue)) return true;
  }

  // Antonym flip.
  for (const [A, B] of OPPOSITES) {
    if ((touches(ta, A) && touches(tb, B)) || (touches(ta, B) && touches(tb, A))) return true;
  }

  // Scope-member flip (different member of the same class on each side).
  for (const cls of SCOPE_CLASSES) {
    const ma = members(ta, cls);
    const mb = members(tb, cls);
    if (ma && mb && ma !== mb) return true;
  }

  // Number mismatch (both carry numbers, but different ones).
  const na = numberSet(a);
  const nb = numberSet(b);
  if (na.size && nb.size) {
    const same = na.size === nb.size && [...na].every((x) => nb.has(x));
    if (!same) return true;
  }

  return false;
}

// ── Tier B: Haiku intent judge (needs ANTHROPIC_API_KEY) ────────────────────

const JUDGE_MODEL = process.env.GUARD_JUDGE_MODEL || process.env.GATEWAY_PRIMARY_MODEL || "claude-haiku-4-5";

export function judgeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const JUDGE_SYSTEM =
  "Two user questions were matched by a semantic cache. Would the correct answer to the FIRST " +
  "also be a correct answer to the SECOND? Consider intent, scope, and polarity — a flip in any " +
  "of these (e.g. safe vs unsafe, today vs tomorrow, adults vs children, 'learn X' vs 'avoid X') " +
  "means NO. Reply with ONLY the word YES or NO.";

/** Returns true if the judge says the two questions share an answer (keep the hit). */
export async function llmJudgeGuard(a: string, b: string): Promise<boolean> {
  const key = process.env.ANTHROPIC_API_KEY;
  // No judge configured ⇒ defer to Tier A (which already passed): keep the hit.
  if (!key) return true;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        max_tokens: 4,
        temperature: 0,
        system: JUDGE_SYSTEM,
        messages: [{ role: "user", content: `FIRST: ${a}\nSECOND: ${b}` }],
      }),
    });
    if (!res.ok) {
      console.error(`judge: anthropic ${res.status}`);
      return false; // we asked for a verdict and couldn't get one ⇒ fail CLOSED
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).map((c) => c.text ?? "").join("").trim().toUpperCase();
    return !text.startsWith("NO");
  } catch (err) {
    console.error("judge failed:", err);
    return false; // a fast wrong answer is worse than a miss ⇒ fail CLOSED
  }
}

/** The full guard: Tier A rejects confidently; otherwise Tier B confirms. */
export async function guardKeepsHit(probeQuery: string, candidateQuery: string): Promise<boolean> {
  if (deterministicReject(probeQuery, candidateQuery)) return false;
  return llmJudgeGuard(probeQuery, candidateQuery);
}
