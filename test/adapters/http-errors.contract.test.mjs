/**
 * Shared contract: adapters surface HTTP failures via HTTPRequestError (status preserved).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { TavilyAdapter } from "../../dist/adapters/tavily.js";
import { SerperAdapter } from "../../dist/adapters/serper.js";
import { HTTPRequestError } from "../../dist/http.js";
import { installFetchMock, rawResponse } from "./_fetch-mock.mjs";

test("search adapters propagate HTTP status (429)", async () => {
  const restore = installFetchMock({
    "POST https://api.tavily.com/search": async () => rawResponse("limited", { status: 429 }),
  });
  try {
    const adapter = new TavilyAdapter();
    await assert.rejects(
      () => adapter.search("q", "k"),
      (err) => err instanceof HTTPRequestError && err.status === 429
    );
  } finally {
    restore();
  }
});

test("search adapters propagate HTTP status (403)", async () => {
  const restore = installFetchMock({
    "POST https://google.serper.dev/search": async () => rawResponse("forbidden", { status: 403 }),
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
