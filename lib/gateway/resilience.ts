/**
 * Resilience: provider failover with a circuit breaker, and the honest boundary
 * that every gateway hits.
 *
 * The hard truth (verbatim from OpenRouter's docs, and why LiteLLM's mid-stream
 * continuation is a mess): once the first token has been sent, the HTTP response
 * headers are committed and you CANNOT silently fail over — partial content is
 * already on the wire. So the only correct failover is BEFORE the first token.
 * `establishStream` therefore tries providers in order and only commits to one
 * once it yields its first event; a provider that errors before that is skipped
 * (a "rescue"). After commitment, a mid-stream error is surfaced as partial +
 * error — never a faked seamless retry.
 *
 * The circuit breaker stops hammering a provider that's down: after a few
 * consecutive failures it's pulled from the pool for a cooldown.
 */
import type { GatewayRequest, ProviderEvent, ProviderName } from "./types";
import type { Provider } from "./providers/types";

const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 30_000;

type Breaker = { fails: number; openUntil: number };
const breakers = new Map<ProviderName, Breaker>();

export function isOpen(name: ProviderName): boolean {
  const b = breakers.get(name);
  return !!b && b.openUntil > Date.now();
}

export function recordSuccess(name: ProviderName): void {
  breakers.delete(name);
}

export function recordFailure(name: ProviderName): void {
  const b = breakers.get(name) ?? { fails: 0, openUntil: 0 };
  b.fails += 1;
  if (b.fails >= FAIL_THRESHOLD) {
    b.openUntil = Date.now() + COOLDOWN_MS;
    b.fails = 0;
  }
  breakers.set(name, b);
}

/** Test/demo hook. */
export function resetBreakers(): void {
  breakers.clear();
}

export type Committed = {
  provider: Provider;
  model: string;
  gen: AsyncGenerator<ProviderEvent>;
  /** The first event, already pulled — this is the commitment point. */
  first: ProviderEvent;
  /** True if we had to move past a failed/open provider to get here. */
  rescued: boolean;
  /** Honest trail of what was attempted, in order. */
  tried: string[];
};

/**
 * Walk the provider chain and return the first that yields a first event —
 * committing to it (pre-first-token failover). Returns null if all fail. Throws
 * on client abort so the caller can stop cleanly.
 */
export async function establishStream(
  chain: Provider[],
  req: GatewayRequest,
  signal?: AbortSignal,
): Promise<Committed | null> {
  let rescued = false;
  const tried: string[] = [];

  for (const provider of chain) {
    // The mock never goes down — it's the guaranteed last resort.
    if (provider.name !== "mock" && isOpen(provider.name)) {
      tried.push(`${provider.name}:breaker-open`);
      rescued = true;
      continue;
    }
    const model = provider.canServe(req.model) ? req.model : provider.defaultModel;
    const pReq = model === req.model ? req : { ...req, model };
    tried.push(`${provider.name}:${model}`);
    try {
      // Demo control: simulate this provider being down to show failover.
      if (req.forceOutage === provider.name && provider.name !== "mock") {
        throw new Error(`${provider.name} outage (demo)`);
      }
      const gen = provider.stream(pReq, signal);
      const first = await gen.next(); // triggers the request; may throw pre-first-token
      if (first.done) throw new Error(`${provider.name} produced no events`);
      recordSuccess(provider.name);
      return { provider, model, gen, first: first.value, rescued, tried };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      recordFailure(provider.name);
      rescued = true; // this candidate failed before the first token → try the next
      continue;
    }
  }
  return null;
}
