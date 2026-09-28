import assert from "node:assert/strict";
import { test } from "node:test";
import { sameScope, scopeKey } from "../lib/gateway/scopeKey";
import type { ChatRequest } from "../lib/gateway/providers/types";

const request = (messages: ChatRequest["messages"]): ChatRequest => ({
  system: "Be concise",
  messages,
  model: "mock",
  maxTokens: 100,
});

test("cache keys distinguish prior conversation turns", () => {
  const a = scopeKey(request([
    { role: "user", content: "I live in Paris" },
    { role: "assistant", content: "Noted" },
    { role: "user", content: "Where do I live?" },
  ]));
  const b = scopeKey(request([
    { role: "user", content: "I live in Rome" },
    { role: "assistant", content: "Noted" },
    { role: "user", content: "Where do I live?" },
  ]));
  assert.notEqual(a.hash, b.hash);
  assert.equal(sameScope(a, b), false);
});

test("paraphrases retain semantic scope when history matches", () => {
  const messages: ChatRequest["messages"] = [
    { role: "user", content: "I live in Paris" },
    { role: "assistant", content: "Noted" },
    { role: "user", content: "Where do I live?" },
  ];
  const a = scopeKey(request(messages));
  const b = scopeKey(request([...messages.slice(0, -1), { role: "user", content: "What city am I in?" }]));
  assert.notEqual(a.hash, b.hash);
  assert.equal(sameScope(a, b), true);
});
