import test from "node:test";
import assert from "node:assert/strict";
import { SerperAdapter } from "../../dist/adapters/serper.js";
import { installFetchMock, jsonResponse, rawResponse } from "./_fetch-mock.mjs";
import { HTTPRequestError } from "../../dist/http.js";

test("serper search normalizes organic results", async () => {
  const restore = installFetchMock({
    "POST https://google.serper.dev/search": async () =>
      jsonResponse({
        organic: [{ title: "A", link: "https://a.example", snippet: "aa", position: 2 }],
      }),
  });
  try {
    const adapter = new SerperAdapter();
    const results = await adapter.search("q", "k");
    assert.equal(results.length, 1);
    assert.equal(results[0].source, "serper");
    assert.equal(results[0].score, 1 / 2);
  } finally {
    restore();
  }
});

test("serper propagates auth failures", async () => {
  const restore = installFetchMock({
    "POST https://google.serper.dev/search": async () => rawResponse("no", { status: 403 }),
  });
  try {
    const adapter = new SerperAdapter();
    await assert.rejects(
      () => adapter.search("q", "k"),
      (err) => err instanceof HTTPRequestError && err.status === 403
    );
  } finally {
    restore();
  }
});

