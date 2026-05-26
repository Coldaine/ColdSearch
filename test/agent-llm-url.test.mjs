import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIClient } from "../dist/agent/llm.js";

test("OpenAIClient accepts full chat-completions URL as base", () => {
  const prev = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_BASE_URL = "https://proxy.example/v1/chat/completions";
  try {
    const client = new OpenAIClient(
      "k",
      "gpt-4o",
      process.env.OPENAI_BASE_URL
    );
    assert.equal(
      client["chatCompletionsUrl"](),
      "https://proxy.example/v1/chat/completions"
    );
  } finally {
    if (prev === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = prev;
  }
});

test("OpenAIClient appends chat-completions to API root base", () => {
  const client = new OpenAIClient("k", "gpt-4o", "https://api.openai.com/v1");
  assert.equal(
    client["chatCompletionsUrl"](),
    "https://api.openai.com/v1/chat/completions"
  );
});
