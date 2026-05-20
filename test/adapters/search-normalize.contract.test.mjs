/**
 * Shared contract: search adapters map mocked vendor JSON to NormalizedResult[].
 * Provider-specific edge cases stay in that provider's test file.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { BraveAdapter } from "../../dist/adapters/brave.js";
import { SerperAdapter } from "../../dist/adapters/serper.js";
import { ExaAdapter } from "../../dist/adapters/exa.js";
import { installFetchMock, jsonResponse } from "./_fetch-mock.mjs";

const SEARCH_CONTRACTS = [
  {
    name: "brave",
    Adapter: BraveAdapter,
    handler: async ({ url }) => {
      assert.match(url, /^https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search\?/);
      return jsonResponse({
        web: {
          results: [{ title: "A", url: "https://a.example", description: "aa", relevance_score: 0.6 }],
        },
      });
    },
    assertResult(results) {
      assert.equal(results[0].source, "brave");
      assert.equal(results[0].snippet, "aa");
    },
  },
  {
    name: "serper",
    Adapter: SerperAdapter,
    handler: async () =>
      jsonResponse({
        organic: [{ title: "A", link: "https://a.example", snippet: "aa", position: 2 }],
      }),
    assertResult(results) {
      assert.equal(results[0].source, "serper");
      assert.equal(results[0].score, 0.5);
    },
  },
  {
    name: "exa",
    Adapter: ExaAdapter,
    handler: async () =>
      jsonResponse({
        results: [{ title: "A", url: "https://a.example", text: "aa", score: 0.7 }],
      }),
    assertResult(results) {
      assert.equal(results[0].source, "exa");
      assert.equal(results[0].snippet, "aa");
    },
  },
];

for (const contract of SEARCH_CONTRACTS) {
  test(`search adapter contract: ${contract.name}`, async () => {
    const restore = installFetchMock({
      "*": contract.handler,
    });
    try {
      const adapter = new contract.Adapter();
      const results = await adapter.search("q", "k");
      assert.equal(results.length, 1);
      assert.equal(results[0].url, "https://a.example");
      contract.assertResult(results);
    } finally {
      restore();
    }
  });
}
