import test from "node:test";
import assert from "node:assert/strict";
import { ExaAdapter } from "../../dist/adapters/exa.js";
import { installFetchMock, jsonResponse } from "./_fetch-mock.mjs";

test("exa crawl discovers then fetches contents", async () => {
  let searchCalled = 0;
  let contentsCalled = 0;

  const restore = installFetchMock({
    "POST https://api.exa.ai/search": async ({ init }) => {
      searchCalled++;
      const body = JSON.parse(init.body);
      assert.match(body.query, /^site:/);
      return jsonResponse({
        results: [{ url: "https://x.example/a", title: "A" }],
      });
    },
    "POST https://api.exa.ai/contents": async ({ init }) => {
      contentsCalled++;
      const body = JSON.parse(init.body);
      assert.ok(Array.isArray(body.urls));
      return jsonResponse({
        results: [
          { url: "https://x.example", title: "Root", text: "r" },
          { url: "https://x.example/a", title: "A", text: "a" },
        ],
      });
    },
  });

  try {
    const adapter = new ExaAdapter();
    const results = await adapter.crawl("https://x.example", "k", { limit: 2 });
    assert.equal(searchCalled, 1);
    assert.equal(contentsCalled, 1);
    assert.equal(results.length, 2);
    assert.deepEqual(Object.keys(results[0]).sort(), ["content", "title", "url"]);
  } finally {
    restore();
  }
});

