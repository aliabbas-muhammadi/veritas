/**
 * The provider abstraction. Every upstream LLM (Anthropic, OpenAI, the offline
 * mock) is normalized to ONE shape: a stream of {@link ProviderEvent}s. The
 * gateway never sees a provider's native wire format — that's the whole point of
 * a gateway, and it's what lets routing, caching, and failover stay
 * provider-agnostic.
 *
 * Embedding is deliberately NOT on this interface: the semantic-cache embedder
 * (OpenAI text-embedding-3-small) is one shared service independent of whichever
 * provider answers, so it lives in `../embed.ts`, not per-provider.
 */

export type Role = "user" | "assistant";
export type Message = { role: Role; content: string };

/** A normalized, provider-agnostic chat request (an OpenAI-ish superset). */
export type ChatRequest = {
  system?: string;
  messages: Message[];
  model: string;
  /** Default 0. Bucketed into the scope key so float noise isn't a cache miss. */
  temperature?: number;
  /** Default 1. */
  topP?: number;
  maxTokens: number;
};

export type Usage = { inputTokens: number; outputTokens: number };

/**
 * The normalized streaming unit. `first_token` marks time-to-first-token AND the
 * failover commit point: once it's emitted, the response headers are on the wire
 * and clean cross-provider failover is no longer possible (see resilience, P4).
 */
export type ProviderEvent =
  | { type: "first_token"; at: number }
  | { type: "text"; text: string }
  | { type: "done"; model: string; usage?: Usage };

export type ProviderName = "anthropic" | "openai" | "mock";

export interface Provider {
  readonly name: ProviderName;
  /** The model this provider serves by default (e.g. its cheap demo model). */
  readonly defaultModel: string;
  /** Whether this provider can serve the requested model id (for failover mapping). */
  canServe(model: string): boolean;
  /** True when the provider is usable right now (key present, not forced down). */
  available(): boolean;
  /** Stream a normalized response. Throws on transport error (resilience wraps it, P4). */
  stream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ProviderEvent>;
}
