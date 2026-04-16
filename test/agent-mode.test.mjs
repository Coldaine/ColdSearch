import test from "node:test";
import assert from "node:assert/strict";
import { SearchAgent } from "../dist/agent/agent.js";
import { ResearchContext } from "../dist/agent/context.js";

function makeFakeLLM(responses) {
  let i = 0;
  return {
    complete: async () => {
      const content = responses[Math.min(i, responses.length - 1)];
      i++;
      return { content };
    },
  };
}

test("tool dispatch routes to backend search via the search tool", async () => {
  process.env.ANTHROPIC_API_KEY ||= "test-key";

  const calls = [];
  const backend = {
    search: async (query) => {
      calls.push({ query });
      return {
        results: [{ title: "T", url: "https://x.example", snippet: "s", score: 1, source: "brave" }],
        providersUsed: ["brave"],
        errors: {},
      };
    },
  };

  const agent = new SearchAgent({ executionBackend: backend });
  agent.llm = makeFakeLLM([
    JSON.stringify({ type: "tool", tool: "search", args: ["hello"] }),
    JSON.stringify({ type: "final", answer: "done" }),
  ]);

  const out = await agent.research("goal", { maxSteps: 2 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].query, "hello");
  assert.ok(out.answer.startsWith("done"));
  assert.match(out.answer, /Sources:/);
  assert.equal(out.sources.length, 1);
});

test("SSRF guard blocks loopback, link-local, and metadata hostnames", async () => {
  process.env.ANTHROPIC_API_KEY ||= "test-key";
  const agent = new SearchAgent({ executionBackend: { search: async () => ({ results: [], providersUsed: [], errors: {} }) } });

  await assert.rejects(
    () => agent.validateFetchUrl("http://localhost:1234/"),
    /refusing to fetch internal hostname/i
  );
  await assert.rejects(
    () => agent.validateFetchUrl("http://127.0.0.1/"),
    /refusing to fetch non-public ip/i
  );
  await assert.rejects(
    () => agent.validateFetchUrl("http://169.254.169.254/latest/meta-data/"),
    /refusing to fetch internal hostname/i
  );
});

test("ResearchContext deduplicates sources and enforces maxSources", () => {
  const ctx = new ResearchContext("g", 2);
  ctx.addSource({ title: "A", url: "https://x.example/a", snippet: "s", score: 1, source: "p" });
  ctx.addSource({ title: "A2", url: "https://x.example/a", snippet: "s", score: 0.5, source: "p2" });
  ctx.addSource({ title: "B", url: "https://x.example/b", snippet: "s", score: 1, source: "p" });
  ctx.addSource({ title: "C", url: "https://x.example/c", snippet: "s", score: 1, source: "p" });

  assert.equal(ctx.sources.length, 2);
  assert.deepEqual(ctx.sources.map((s) => s.url), ["https://x.example/a", "https://x.example/b"]);
});

test("maxSteps enforcement returns a final answer even if model keeps calling tools", async () => {
  process.env.ANTHROPIC_API_KEY ||= "test-key";
  const backend = {
    search: async () => ({ results: [], providersUsed: ["brave"], errors: {} }),
  };
  const agent = new SearchAgent({ executionBackend: backend });

  // First response triggers a tool call, then when the loop ends we return a final payload.
  agent.llm = {
    complete: async (messages) => {
      const last = messages[messages.length - 1]?.content || "";
      if (/Maximum steps reached/i.test(last)) {
        return { content: JSON.stringify({ type: "final", answer: "fallback" }) };
      }
      return { content: JSON.stringify({ type: "tool", tool: "search", args: ["q"] }) };
    },
  };

  const out = await agent.research("goal", { maxSteps: 1 });
  assert.equal(out.answer, "fallback");
});

