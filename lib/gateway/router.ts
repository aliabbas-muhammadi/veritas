/**
 * Routing — deliberately minimal and honest.
 *
 * The independent RouterArena benchmark (arXiv:2510.00202) found that most
 * "smart" routers reach only ~60–75% of oracle accuracy, frequently fail to beat
 * a single strong model, and can have enough overhead to erase their own savings.
 * So this module ships a TRANSPARENT, conservative cascade heuristic, OFF by
 * default (GATEWAY_ROUTING=on), and makes no quality claim it hasn't measured.
 *
 * The bar to clear before trusting a router: a routing-quality eval showing it
 * beats BOTH always-cheap and always-strong on held-out prompts without
 * collapsing to one model. That eval is future work — and being honest about
 * routing's limits is more useful than a "beats GPT-4" headline that doesn't hold.
 */
import type { GatewayRequest } from "./types";

const STRONG = process.env.GATEWAY_STRONG_MODEL || "claude-opus-4-8";
const CHEAP = process.env.GATEWAY_PRIMARY_MODEL || "claude-haiku-4-5";

// Signals a prompt MIGHT need the strong model. Prompt length is a known-weak
// proxy for complexity (RouterArena), so this is a starting point, not a verdict.
const COMPLEX_HINTS =
  /\b(prove|derive|step[- ]by[- ]step|analy[sz]e|refactor|debug|edge cases?|trade[- ]?offs?|architect)\b/i;

export function routingEnabled(): boolean {
  return process.env.GATEWAY_ROUTING === "on";
}

/** A conservative cascade pick: cheap unless the prompt looks hard. No-op unless
 * GATEWAY_ROUTING=on, so the shipped default path is unaffected. */
export function routeModel(req: GatewayRequest, query: string): string {
  if (!routingEnabled()) return req.model;
  const looksHard = query.length > 600 || COMPLEX_HINTS.test(query);
  return looksHard ? STRONG : CHEAP;
}
