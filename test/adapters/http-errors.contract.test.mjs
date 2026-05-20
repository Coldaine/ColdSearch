/**
 * Shared contract: adapters surface HTTP failures via HTTPRequestError (status preserved).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { TavilyAdapter } from "../../dist/adapters/tavily.js";
import { SerperAdapter } from "../../dist/adapters/serper.js";
import { BraveAdapter } from "../../dist/adapters/brave.js";
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

test("search adapters propagate HTTP status (401)", async () => {
  const restore = installFetchMock({
    "GET https://api.search.brave.com/res/v1/web/search?q=q&count=10&offset=0": async () =>
      rawResponse("unauthorized", { status: 401 }),
  });
  try {
    const adapter = new BraveAdapter();
    await assert.rejects(
      () => adapter.search("q", "k"),
      (err) => err instanceof HTTPRequestError && err.status === 401
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
