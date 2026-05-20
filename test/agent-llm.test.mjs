import test from "node:test";
import assert from "node:assert/strict";
import { createLLMClient } from "../dist/agent/llm.js";

test("createLLMClient rejects unsupported providers", () => {
  assert.throws(
    () => createLLMClient(/** @type {any} */ ("anthropic")),
    /Unsupported LLM provider/
  );
});
