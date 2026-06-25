/**
 * The provider registry + failover order: primary (Anthropic) → fallback
 * (OpenAI) → mock (always available, never bills, never down). The mock
 * guarantees the gateway always returns *something*, which keeps the keyless
 * demo and CI working.
 *
 * Forced outages (the demo control) are applied per-attempt inside
 * resilience.establishStream, NOT by pruning the chain here — so a forced outage
 * actually exercises the failover path and is counted as a "rescue".
 */
import type { Provider } from "./types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { MockProvider } from "./mock";

const anthropic = new AnthropicProvider();
const openai = new OpenAIProvider();
const mock = new MockProvider();

/** The ordered list of providers to try for a request. */
export function providerChain(): Provider[] {
  const chain: Provider[] = [];
  for (const p of [anthropic, openai]) if (p.available()) chain.push(p);
  chain.push(mock); // last resort
  return chain;
}
