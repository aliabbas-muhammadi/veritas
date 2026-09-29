import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/chat/route";
import { clear } from "../lib/gateway/cache";

const request = (extra: Record<string, unknown> = {}) => new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }], model: "mock", ...extra }),
});

test("chat route rejects invalid numeric and cache settings", async () => {
  for (const extra of [
    { maxTokens: 0 },
    { maxTokens: 1.5 },
    { temperature: "hot" },
    { topP: 0 },
    { cache: { mode: "auto", threshold: -1 } },
    { cache: { mode: "auto", threshold: "0.7" } },
    { cache: { mode: "invalid" } },
  ]) {
    const res = await POST(request(extra));
    assert.equal(res.status, 400, JSON.stringify(extra));
  }
});

test("chat route passes topP through to cache scope", async () => {
  clear();
  const first = await (await POST(request({ topP: 0.2 }))).text();
  const second = await (await POST(request({ topP: 0.8 }))).text();
  assert.equal(JSON.parse(first.split("\n")[0]!).cache, "miss");
  assert.equal(JSON.parse(second.split("\n")[0]!).cache, "miss");
  clear();
});
