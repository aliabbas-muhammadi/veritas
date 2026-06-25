/**
 * A minimal Server-Sent-Events reader over a fetch Response body. Anthropic and
 * OpenAI both stream SSE but in different shapes (Anthropic uses typed `event:`
 * lines; OpenAI sends bare `data:` chunks ending in `[DONE]`) — normalizing them
 * into one parsed stream is the first job of a provider-agnostic gateway.
 */
export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event?: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      // SSE messages are separated by a blank line.
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let event: string | undefined;
        const dataLines: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length) yield { event, data: dataLines.join("\n") };
      }
    }
    // Stream ended: flush a trailing message that lacked a final blank line
    // (the connection can close right after the last `data:` with no `\n\n`).
    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail) {
      let event: string | undefined;
      const dataLines: string[] = [];
      for (const line of tail.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) yield { event, data: dataLines.join("\n") };
    }
  } finally {
    reader.releaseLock();
  }
}

export async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
