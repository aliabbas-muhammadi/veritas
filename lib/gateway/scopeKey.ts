/**
 * The scope key — computed BEFORE any cache lookup, because it gates every cache
 * decision. Two requests share a cached answer only if their whole scope matches
 * (system prompt, model, sampling params), not just the query text. This is
 * itself a correctness guard: "scope isolation" is a measured ablation arm in the
 * eval, because a query-only key admits cross-scope false positives.
 */
import { createHash } from "node:crypto";
import type { ChatRequest, Message } from "./providers/types";
import type { CacheKey } from "./types";

/** Canonicalize free text so trivial whitespace/case noise isn't a cache miss. */
export function canonical(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The last user turn — the thing we actually cache and embed. */
export function lastUserQuery(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === "user") return m.content;
  }
  return "";
}

export function scopeKey(req: ChatRequest): CacheKey {
  const system = canonical(req.system ?? "");
  const query = canonical(lastUserQuery(req.messages));
  const model = req.model;
  // Bucket temperature to 0.1 — exact floats are sampling noise, not intent.
  const tempBin = Math.round((req.temperature ?? 0) * 10) / 10;
  const topP = req.topP ?? 1;
  const maxTokens = req.maxTokens;
  const hash = createHash("sha256")
    .update(JSON.stringify([system, query, model, tempBin, topP, maxTokens]))
    .digest("hex");
  return { system, query, model, tempBin, topP, maxTokens, hash };
}

/** True when two keys share everything EXCEPT the query — the scope-isolation
 * predicate the semantic tier uses to refuse cross-scope candidates. */
export function sameScope(a: CacheKey, b: CacheKey): boolean {
  return (
    a.system === b.system &&
    a.model === b.model &&
    a.tempBin === b.tempBin &&
    a.topP === b.topP &&
    a.maxTokens === b.maxTokens
  );
}
