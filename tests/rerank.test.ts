import assert from "node:assert/strict";
import { test } from "node:test";
import { llmJudgeGuard } from "../lib/gateway/rerank";

test("judge accepts only an explicit YES verdict", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  try {
    for (const [reply, expected] of [["YES", true], ["NO", false], ["MAYBE", false], ["", false]] as const) {
      globalThis.fetch = async () => new Response(JSON.stringify({ content: [{ type: "text", text: reply }] }));
      assert.equal(await llmJudgeGuard("first", "second"), expected, reply);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  }
});
