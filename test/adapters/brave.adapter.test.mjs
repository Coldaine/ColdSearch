import test from "node:test";
import assert from "node:assert/strict";
import { BraveAdapter } from "../../dist/adapters/brave.js";
import { installFetchMock, jsonResponse, rawResponse } from "./_fetch-mock.mjs";
import { HTTPRequestError } from "../../dist/http.js";

test("brave search normalizes results", async () => {
  const restore = installFetchMock({
    "*": async ({ url }) => {
      assert.match(url, /^https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search\?/);
      return jsonResponse({
        web: {
          results: [{ title: "A", url: "https://a.example", description: "aa", relevance_score: 0.6 }],
        },
      });
    },
  });
  try {
    const adapter = new BraveAdapter();
    const results = await adapter.search("q", "k");
    assert.equal(results.length, 1);
    assert.equal(results[0].source, "brave");
    assert.equal(results[0].snippet, "aa");
  } finally {
    restore();
  }
});

test("brave propagates rate limit errors", async () => {
  const restore = installFetchMock({
    "*": async () => rawResponse("limited", { status: 429 }),
  });
  try {
    const adapter = new BraveAdapter();
    await assert.rejects(
      () => adapter.search("q", "k"),
      (err) => err instanceof HTTPRequestError && err.status === 429
    );
  } finally {
    restore();
  }
});

