import test from "node:test";
import assert from "node:assert/strict";
import { createLLMClient } from "../dist/agent/llm.js";

test("createLLMClient rejects unsupported providers", () => {
  assert.throws(
    () => createLLMClient(/** @type {any} */ ("anthropic")),
    /Unsupported LLM provider/
  );
});

test("createLLMClient accepts OpenAI-compatible alias providers", () => {
  const prev = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-key";
  try {
    const client = createLLMClient("groq");
    assert.equal(typeof client.complete, "function");
  } finally {
    if (prev === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = prev;
  }
});
