/**
 * OpenAI provider via raw HTTP (chat completions, streamed). Symmetric with the
 * Anthropic provider: parses OpenAI's `data: {choices:[{delta:{content}}]}` SSE
 * (terminated by `data: [DONE]`) into the same normalized {@link ProviderEvent}
 * stream. Doubles as the cheap fallback target (gpt-4o-mini) for failover.
 */
import type { ChatRequest, Provider, ProviderEvent, Usage } from "./types";
import { sseEvents, safeText } from "./sse";

const API = "https://api.openai.com/v1/chat/completions";

type OpenAIChunk = {
  choices?: { delta?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class OpenAIProvider implements Provider {
  readonly name = "openai" as const;
  readonly defaultModel = process.env.GATEWAY_FALLBACK_MODEL || "gpt-4o-mini";

  canServe(model: string): boolean {
    return model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3");
  }

  available(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ProviderEvent> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("openai: OPENAI_API_KEY is not set");

    const messages: { role: string; content: string }[] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    for (const m of req.messages) messages.push({ role: m.role, content: m.content });

    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature ?? 0,
        top_p: req.topP,
        stream: true,
        stream_options: { include_usage: true },
        messages,
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`openai: ${res.status} ${await safeText(res)}`);
    }

    let first = true;
    let usage: Usage | undefined;
    for await (const { data } of sseEvents(res.body)) {
      if (data === "[DONE]") break;
      let chunk: OpenAIChunk;
      try {
        chunk = JSON.parse(data) as OpenAIChunk;
      } catch {
        continue;
      }
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) {
        if (first) {
          first = false;
          yield { type: "first_token", at: Date.now() };
        }
        yield { type: "text", text };
      }
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
        };
      }
    }
    yield { type: "done", model: req.model, usage };
  }
}
