import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIClient, resolveLlmConfig } from "../dist/agent/llm.js";

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

test("TOML agent.llm.base_url is used when CLI flag is absent", () => {
  const resolved = resolveLlmConfig(
    {},
    {
      provider: "openai",
      model: "gpt-5-mini",
      baseUrl: "https://toml.example/v1",
    }
  );
  assert.equal(resolved.provider, "openai");
  assert.equal(resolved.model, "gpt-5-mini");
  assert.equal(resolved.baseUrl, "https://toml.example/v1");

  const client = new OpenAIClient("k", resolved.model, resolved.baseUrl);
  assert.equal(
    client["chatCompletionsUrl"](),
    "https://toml.example/v1/chat/completions"
  );
});

test("CLI --llm-base-url overrides TOML agent.llm.base_url", () => {
  const resolved = resolveLlmConfig(
    { provider: "groq", model: "cli-model", baseUrl: "https://cli.example/v1" },
    { provider: "openai", model: "toml-model", baseUrl: "https://toml.example/v1" }
  );
  assert.equal(resolved.provider, "groq");
  assert.equal(resolved.model, "cli-model");
  assert.equal(resolved.baseUrl, "https://cli.example/v1");
});

test("TOML fills only the fields CLI flags leave unset", () => {
  const resolved = resolveLlmConfig(
    { model: "cli-model" },
    {
      provider: "openai",
      model: "toml-model",
      baseUrl: "https://toml.example/v1",
    }
  );
  assert.equal(resolved.provider, "openai");
  assert.equal(resolved.model, "cli-model");
  assert.equal(resolved.baseUrl, "https://toml.example/v1");
});
