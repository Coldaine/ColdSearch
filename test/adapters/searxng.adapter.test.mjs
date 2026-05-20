import test from "node:test";
import assert from "node:assert/strict";
import { SearXNGAdapter } from "../../dist/adapters/searxng.js";
import { installFetchMock, jsonResponse } from "./_fetch-mock.mjs";

test("searxng errors when no baseUrl is configured", async () => {
  const adapter = new SearXNGAdapter();
  await assert.rejects(() => adapter.search("q", ""), /requires providers\.searxng\.options\.baseUrl/i);
});

test("searxng search normalizes results", async () => {
  const restore = installFetchMock({
    "*": async ({ url }) => {
      assert.match(url, /^https:\/\/search\.example\.internal\/search\?/);
      return jsonResponse({
        results: [{ title: "A", url: "https://a.example", content: "aa", score: 0.2 }],
      });
    },
  });
  try {
    const adapter = new SearXNGAdapter();
    const results = await adapter.search("q", "", { providerOptions: { baseUrl: "https://search.example.internal" } });
    assert.equal(results.length, 1);
    assert.equal(results[0].source, "searxng");
    assert.equal(results[0].snippet, "aa");
  } finally {
    restore();
  }
});

