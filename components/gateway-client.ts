/**
 * Client-side glue for the playground: the NDJSON stream reader, the turn model,
 * and the scripted guided tour. Kept out of the React components so the wire
 * handling is testable and the components stay presentational.
 *
 * Everything here runs in the browser (it calls the same `/api/chat` the wire
 * protocol documents). Types are imported from the gateway as type-only, so no
 * server code is pulled into the client bundle.
 */
import type { GuardVerdict, ProviderName, WireEvent } from "@/lib/gateway/types";

export type { WireEvent, GuardVerdict, ProviderName };

/** One exchange in the transcript, accumulated from the wire events. */
export type Turn = {
  id: number;
  query: string;
  /** Streamed answer text so far. */
  text: string;
  /** Cache verdict, once the `meta` event lands. */
  cache?: "exact" | "semantic" | "miss";
  similarity?: number;
  provider?: ProviderName;
  model?: string;
  /** Set when the guard turned a high-similarity candidate into a miss. */
  guard?: GuardVerdict;
  /** Set when a fallback provider served after a pre-first-token failure. */
  rescued?: boolean;
  /** Demo control that produced this turn (for labelling failover). */
  outage?: ProviderName | null;
  /** Final figures from the `done` event. */
  done?: boolean;
  cached?: boolean;
  ttftMs?: number;
  totalMs?: number;
  costUsd?: number;
  error?: string;
  /** True while the request is in flight. */
  streaming: boolean;
};

export type ChatBody = {
  messages: { role: "user"; content: string }[];
  forceOutage?: ProviderName | null;
};

/**
 * POST a query and yield each NDJSON wire event as it arrives. Throws on a
 * non-2xx (e.g. the 429 rate limit) with the server's message.
 */
export async function* streamChat(
  query: string,
  opts: { forceOutage?: ProviderName | null; signal?: AbortSignal } = {},
): AsyncGenerator<WireEvent> {
  const body: ChatBody = { messages: [{ role: "user", content: query }] };
  if (opts.forceOutage) body.forceOutage = opts.forceOutage;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const msg = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => null);
    throw new Error(msg || `request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as WireEvent;
    }
  }
  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail) as WireEvent;
}

// ── The guided tour ──────────────────────────────────────────────────────────

export type Scenario = {
  /** Heading for the arc this step belongs to. */
  arc: string;
  /** Short chip label. */
  label: string;
  /** What this step is meant to show. */
  hint: string;
  query: string;
  forceOutage?: ProviderName | null;
};

/**
 * A scripted narrative: prime → reuse (savings), then prime → flip (correctness)
 * for both the keyless deterministic catch and the semantic judge catch, then an
 * outage (failover). Each "prime" must run before its follow-up so the candidate
 * is in the (per-instance) cache — the chips are ordered to enforce that.
 */
export const SCENARIO: Scenario[] = [
  {
    arc: "Reuse — the savings",
    label: "Prime the cache",
    hint: "A cold question: nothing to reuse, so it streams from the model (a MISS).",
    query: "What is the capital of France?",
  },
  {
    arc: "Reuse — the savings",
    label: "Ask a paraphrase",
    hint: "Different words, identical answer — a semantic HIT, replayed instantly at $0.",
    query: "Which city is the capital of France?",
  },
  {
    arc: "Correctness — the cheap catch",
    label: "Prime a polarity question",
    hint: "Another cold MISS — establishes an answer the next question will try to reuse.",
    query: "Is coffee good for your health?",
  },
  {
    arc: "Correctness — the cheap catch",
    label: "Flip the polarity",
    hint: "Embeds close to the cached question but inverts the answer — the keyless guard blocks it, so no wrong answer is served.",
    query: "Is coffee bad for your health?",
  },
  {
    arc: "Correctness — the subtle catch",
    label: "Prime a framing question",
    hint: "Cold MISS, caching an answer phrased one way.",
    query: "Is this smoothie vegan?",
  },
  {
    arc: "Correctness — the subtle catch",
    label: "Reframe the question",
    hint: "No antonym to catch lexically — only the LLM judge sees that the answer could invert, and blocks it.",
    query: "Does this smoothie contain animal products?",
  },
  {
    arc: "Resilience — the rescue",
    label: "Force a provider outage",
    hint: "The primary fails before its first token — the gateway fails over to the backup and the request is rescued.",
    query: "What does the git rebase command do?",
    forceOutage: "anthropic",
  },
];

export type Capabilities = {
  semantic: boolean;
  judge: boolean;
  liveProvider: boolean;
  threshold: number;
  model: string;
};

export type Metrics = {
  requests: number;
  cache: { exact: number; semantic: number; miss: number; hitRate: number };
  latency: { ttftP50: number; ttftP95: number; totalP50: number; totalP95: number };
  cost: { spentUsd: number; savedUsd: number };
  resilience: { rescued: number; rescuedRate: number };
  guard: { blocked: number };
};
