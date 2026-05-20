import test from "node:test";
import assert from "node:assert/strict";
import { JinaAdapter } from "../../dist/adapters/jina.js";
import { installFetchMock, textResponse, rawResponse } from "./_fetch-mock.mjs";
import { HTTPRequestError } from "../../dist/http.js";

test("jina extract normalizes title prefix", async () => {
  const restore = installFetchMock({
    "*": async ({ url }) => {
      assert.match(url, /^https:\/\/r\.jina\.ai\/http:\/\//);
      return textResponse("Title: Hello\n\nBody");
    },
  });
  try {
    const adapter = new JinaAdapter();
    const result = await adapter.extract("https://x.example", "");
    assert.equal(result.source, "jina");
    assert.equal(result.title, "Hello");
    assert.equal(result.content, "Body");
  } finally {
    restore();
  }
});

test("jina returns error on empty content", async () => {
  const restore = installFetchMock({
    "*": async () => textResponse("   "),
  });
  try {
    const adapter = new JinaAdapter();
    await assert.rejects(() => adapter.extract("https://x.example", ""), /no content extracted/i);
  } finally {
    restore();
  }
});

test("jina propagates HTTP errors", async () => {
  const restore = installFetchMock({
    "*": async () => rawResponse("no", { status: 429 }),
  });
  try {
    const adapter = new JinaAdapter();
    await assert.rejects(
      () => adapter.extract("https://x.example", ""),
      (err) => err instanceof HTTPRequestError && err.status === 429
    );
  } finally {
    restore();
  }
});

