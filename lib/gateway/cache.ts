/**
 * The two-tier semantic cache — the project's hero.
 *
 *   Tier 1  EXACT     O(1) lookup on the scoped hash. 100% precise, free. Catches
 *                     the large fraction of traffic that is verbatim repeats.
 *   Tier 2  SEMANTIC  cosine match of the query embedding against cached entries
 *                     *of the same scope*, above a threshold τ. Catches
 *                     paraphrases — and is where false positives come from.
 *
 * The danger Tier 2 introduces is serving a *semantically-wrong* cached answer
 * (two questions that embed close but need different answers — the classic being
 * negation: "is X safe?" vs "is X NOT safe?"). The eval harness measures exactly
 * that as a false-positive rate. Until the P2 rerank guard lands to confirm
 * intent, the SHIPPED pipeline keeps Tier 2 OFF by default (SEMANTIC_CACHE=off):
 * a fast, wrong answer is worse than a slow, right one.
 *
 * Per-instance, 24h TTL, LRU-capped — like the flagship's demo cache. Production
 * would use a shared store (Redis/Upstash); the interface here is the same.
 */
import type { CacheEntry, CacheKey, CacheResult } from "./types";
import type { ProviderEvent, ProviderName, Usage } from "./providers/types";
import { cosine } from "./similarity";
import { sameScope } from "./scopeKey";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

// Keyed by the Tier-1 scoped hash; iterated for Tier-2 nearest-neighbour search.
const store = new Map<string, CacheEntry>();

function fresh(e: CacheEntry): boolean {
  return Date.now() - e.createdAt <= TTL_MS;
}

export type LookupOptions = {
  /** The query embedding, or null when no embedder was available. */
  embedding: number[] | null;
  /** Operating cosine threshold τ for a Tier-2 hit. */
  threshold: number;
  /** Whether Tier-2 (semantic) is enabled at all. Off by default until the guard. */
  semantic: boolean;
  /**
   * Intent guard run on the top semantic candidate (P2). Returns the kept hit, or
   * null to reject it (e.g. a negation that embeds close but inverts the answer).
   * Absent ⇒ no guard yet.
   */
  guard?: (probeQuery: string, candidate: CacheEntry, similarity: number) => boolean;
};

/** Look an incoming request up: Tier-1 exact first, then Tier-2 semantic. */
export function lookup(key: CacheKey, opts: LookupOptions): CacheResult {
  // Tier 1 — exact, always on.
  const exact = store.get(key.hash);
  if (exact && fresh(exact)) {
    touch(key.hash, exact);
    return { entry: exact, tier: "exact", similarity: 1 };
  }

  // Tier 2 — semantic, opt-in. Scope-isolated: never match across system/model/params.
  if (opts.semantic && opts.embedding) {
    let best: { entry: CacheEntry; sim: number } | null = null;
    for (const entry of store.values()) {
      if (!fresh(entry) || !entry.embedding) continue;
      if (!sameScope(entry.key, key)) continue;
      const sim = cosine(opts.embedding, entry.embedding);
      if (sim >= opts.threshold && (!best || sim > best.sim)) best = { entry, sim };
    }
    if (best) {
      // The guard is the difference between a hit rate and a *correct* hit rate.
      // Report the rejected candidate so the caller can surface the catch.
      if (opts.guard && !opts.guard(key.query, best.entry, best.sim)) {
        return { tier: "miss", rejected: { candidate: best.entry, similarity: best.sim } };
      }
      // LRU-touch the matched ANCHOR under its OWN hash (not the probe's), so a
      // recently-reused semantic entry isn't evicted before colder ones.
      touch(best.entry.key.hash, best.entry);
      return { entry: best.entry, tier: "semantic", similarity: best.sim };
    }
  }

  return { tier: "miss" };
}

/** Store a completed, successful exchange for cheap replay. */
export function put(
  key: CacheKey,
  provider: ProviderName,
  embedding: number[] | null,
  events: ProviderEvent[],
  usage?: Usage,
): void {
  store.set(key.hash, {
    key,
    query: key.query,
    provider,
    embedding,
    events,
    usage,
    createdAt: Date.now(),
  });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** LRU touch: re-insert so it counts as most-recently-used. */
function touch(hash: string, entry: CacheEntry): void {
  store.delete(hash);
  store.set(hash, entry);
}

/** Test/demo hook — clear the in-memory store. */
export function clear(): void {
  store.clear();
}
