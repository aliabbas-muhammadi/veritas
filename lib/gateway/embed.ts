/**
 * The semantic-cache embedder. Live query embedding via OpenAI
 * text-embedding-3-small (the same model the eval's committed vectors use, so
 * the live cache decision matches what the harness measured).
 *
 * Degrades gracefully, exactly like the flagship's embedQuery: with no
 * OPENAI_API_KEY (or on any API error) it returns null, and the cache falls back
 * to its exact (Tier-1) tier. No key required to run the gateway.
 */

const MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

export function embeddingAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function embed(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: text }),
    });
    if (!res.ok) {
      console.error(`embed: OpenAI ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("embed failed:", err);
    return null;
  }
}
