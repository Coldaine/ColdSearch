import test from "node:test";
import assert from "node:assert/strict";
import { ExaAdapter } from "../../dist/adapters/exa.js";
import { HTTPRequestError } from "../../dist/http.js";
import { installFetchMock, jsonResponse, rawResponse } from "./_fetch-mock.mjs";

test("exa search normalizes results", async () => {
  const restore = installFetchMock({
    "POST https://api.exa.ai/search": async () =>
      jsonResponse({
        results: [{ title: "A", url: "https://a.example", text: "aa", score: 0.7 }],
      }),
  });
  try {
    const adapter = new ExaAdapter();
    const results = await adapter.search("q", "k");
    assert.equal(results.length, 1);
    assert.equal(results[0].source, "exa");
    assert.equal(results[0].snippet, "aa");
  } finally {
    restore();
  }
});

test("exa extract returns ExtractResult shape", async () => {
  const restore = installFetchMock({
    "POST https://api.exa.ai/contents": async () =>
      jsonResponse({
        results: [{ title: "T", url: "https://x.example", text: "body" }],
      }),
  });
  try {
    const adapter = new ExaAdapter();
    const result = await adapter.extract("https://x.example", "k");
    assert.equal(result.source, "exa");
    assert.equal(result.url, "https://x.example");
    assert.equal(result.content, "body");
  } finally {
    restore();
  }
});

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

test("exa propagates auth failures", async () => {
  const restore = installFetchMock({
    "POST https://api.exa.ai/search": async () =>
      rawResponse("nope", { status: 401, headers: { "Content-Type": "text/plain" } }),
  });
  try {
    const adapter = new ExaAdapter();
    await assert.rejects(
      () => adapter.search("q", "k"),
      (err) => err instanceof HTTPRequestError && err.status === 401
    );
  } finally {
    restore();
  }
});

