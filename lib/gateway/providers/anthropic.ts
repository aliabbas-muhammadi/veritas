/**
 * Anthropic (Claude) provider via raw HTTP — no SDK, so the streaming format is
 * fully under our control and symmetric with the OpenAI provider. Parses the
 * Messages API SSE (`content_block_delta` → text) into the normalized
 * {@link ProviderEvent} stream. Degrades to the mock provider upstream when no
 * key is set; throws on transport error so resilience (P4) can fail over.
 */
import type { ChatRequest, Provider, ProviderEvent, Usage } from "./types";
import { sseEvents, safeText } from "./sse";

const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

type AnthropicDelta = { type?: string; text?: string };
type AnthropicStreamEvent = {
  delta?: AnthropicDelta;
  message?: { usage?: { input_tokens?: number } };
  usage?: { output_tokens?: number };
};

export class AnthropicProvider implements Provider {
  readonly name = "anthropic" as const;
  readonly defaultModel = process.env.GATEWAY_PRIMARY_MODEL || "claude-haiku-4-5";

  canServe(model: string): boolean {
    return model.startsWith("claude");
  }

  available(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ProviderEvent> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("anthropic: ANTHROPIC_API_KEY is not set");

    const res = await fetch(API, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature ?? 0,
        top_p: req.topP,
        system: req.system,
        stream: true,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`anthropic: ${res.status} ${await safeText(res)}`);
    }

    let first = true;
    let usage: Usage | undefined;
    for await (const { event, data } of sseEvents(res.body)) {
      if (data === "[DONE]") break;
      let ev: AnthropicStreamEvent;
      try {
        ev = JSON.parse(data) as AnthropicStreamEvent;
      } catch {
        continue;
      }
      if (event === "content_block_delta" && ev.delta?.type === "text_delta") {
        if (first) {
          first = false;
          yield { type: "first_token", at: Date.now() };
        }
        yield { type: "text", text: ev.delta.text ?? "" };
      } else if (event === "message_start" && ev.message?.usage) {
        usage = { inputTokens: ev.message.usage.input_tokens ?? 0, outputTokens: 0 };
      } else if (event === "message_delta" && ev.usage) {
        usage = {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: ev.usage.output_tokens ?? 0,
        };
      } else if (event === "error") {
        throw new Error(`anthropic stream error: ${data}`);
      }
    }
    yield { type: "done", model: req.model, usage };
  }
}
