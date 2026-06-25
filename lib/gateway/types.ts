/** Core types for the Veritas gateway: cache, routing, observability, wire. */

import type { ChatRequest, ProviderEvent, ProviderName, Usage } from "./providers/types";

/**
 * The SCOPED cache key. A paraphrase asked under a different system prompt,
 * model, or sampling params is a *different request* and must not share a cached
 * answer — so the key folds all of them in, not just the query text. `hash` is
 * the Tier-1 exact-match key; the structured fields drive scope isolation in the
 * semantic tier.
 */
export type CacheKey = {
  system: string;
  query: string;
  model: string;
  tempBin: number;
  topP: number;
  maxTokens: number;
  hash: string;
};

/** One cached exchange: its scoped key, the query embedding (for Tier-2), and
 * the replayable normalized stream. `embedding` is null when no embedder was
 * available, which makes the entry Tier-1 (exact) only. */
export type CacheEntry = {
  key: CacheKey;
  query: string;
  /** Which provider originally produced this answer (reported on a cache hit). */
  provider: ProviderName;
  embedding: number[] | null;
  events: ProviderEvent[];
  usage?: Usage;
  createdAt: number;
};

export type CacheTier = "exact" | "semantic";

export type CacheHit = {
  entry: CacheEntry;
  tier: CacheTier;
  /** 1 for an exact hit; cosine similarity for a semantic hit. */
  similarity: number;
  /** The guard's confidence that intent matched (set once the P2 guard lands). */
  guardScore?: number;
};

export type CacheMiss = { tier: "miss" };
export type CacheResult = CacheHit | CacheMiss;

export function isHit(r: CacheResult): r is CacheHit {
  return r.tier !== "miss";
}

export type RouteDecision = {
  model: string;
  provider: ProviderName;
  reason: "default" | "escalated" | "failover";
  /** Honest trail of providers/models attempted, in order. */
  candidatesTried: string[];
};

/** What the gateway accepts: a chat request plus demo/cache controls. */
export type GatewayRequest = ChatRequest & {
  cache?: { mode: "auto" | "off"; threshold?: number };
  /** Demo-only: force a provider "outage" to show pre-first-token failover. */
  forceOutage?: ProviderName | null;
};

/**
 * OpenTelemetry GenAI-shaped observability event. The `gen_ai.*` keys are the
 * portable semantic-convention names; gateway-specific signals are namespaced
 * under `veritas.*` so the standard attributes stay drop-in for any OTel backend.
 * (Emitted by `observe.ts` in P3.)
 */
export type ObserveEvent = {
  "gen_ai.system": ProviderName;
  "gen_ai.request.model": string;
  "gen_ai.response.model": string;
  "gen_ai.usage.input_tokens"?: number;
  "gen_ai.usage.output_tokens"?: number;
  "veritas.cache.tier": CacheTier | "miss";
  "veritas.cache.similarity"?: number;
  "veritas.cache.dollars_saved"?: number;
  "veritas.latency.ttft_ms"?: number;
  "veritas.latency.total_ms": number;
  "veritas.cost.dollars": number;
  "veritas.resilience.rescued"?: boolean;
};

/**
 * The NDJSON wire protocol the client consumes. A `meta` event arrives first
 * (so the UI can show the cache verdict + chosen model immediately), then `text`
 * deltas, then a single `done` — or an `error`.
 */
export type WireEvent =
  | {
      type: "meta";
      cache: CacheTier | "miss";
      similarity?: number;
      model: string;
      provider: ProviderName;
    }
  | { type: "first_token"; at: number }
  | { type: "text"; text: string }
  | {
      type: "done";
      model: string;
      usage?: Usage;
      cached: boolean;
      ttftMs?: number;
      totalMs: number;
      costUsd: number;
    }
  | { type: "error"; message: string };

export type { ChatRequest, ProviderEvent, ProviderName, Usage };
