/**
 * The deterministic offline provider. With no API keys set, the gateway still
 * works end-to-end (and the public demo still runs at $0 if live quota is
 * exhausted) by serving a deterministic answer derived from the query. It never
 * bills and never goes "down", so it's always the last link in the failover
 * chain.
 */
import type { ChatRequest, Provider, ProviderEvent } from "./types";

export class MockProvider implements Provider {
  readonly name = "mock" as const;
  readonly defaultModel = "mock";

  canServe(): boolean {
    return true; // the offline mock echoes whatever model was requested
  }

  available(): boolean {
    return true;
  }

  async *stream(req: ChatRequest): AsyncGenerator<ProviderEvent> {
    const q =
      [...req.messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
    const answer =
      `You asked: "${q}". This is a deterministic offline (mock) response from the ` +
      `Veritas gateway — no provider key is set, so nothing was billed. Set ` +
      `ANTHROPIC_API_KEY or OPENAI_API_KEY to route this to a live model.`;
    const tokens = answer.match(/\S+\s*/g) ?? [answer];

    yield { type: "first_token", at: Date.now() };
    for (const t of tokens) yield { type: "text", text: t };
    yield {
      type: "done",
      model: req.model,
      usage: { inputTokens: Math.ceil(q.length / 4), outputTokens: tokens.length },
    };
  }
}
