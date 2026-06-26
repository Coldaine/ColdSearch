import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_STATUSES,
  REQUIRED_PROVIDER_PATHS,
  selectTargets,
} from "../scripts/provider-pass-through.mjs";

test("Phase 0 harness enumerates every required provider path", () => {
  assert.deepEqual(
    REQUIRED_PROVIDER_PATHS.map(({ provider, path }) => `${provider}:${path}`),
    [
      "tavily:search",
      "tavily:extract",
      "tavily:crawl",
      "firecrawl:search",
      "firecrawl:extract",
      "firecrawl:crawl",
      "exa:search",
      "exa:extract",
      "exa:crawl",
      "brave:search",
      "serper:search",
      "jina:extract",
      "searxng:search",
    ]
  );
});

test("Phase 0 harness only emits plan-approved row statuses", () => {
  assert.deepEqual(ALLOWED_STATUSES, [
    "pass",
    "fail",
    "blocked_missing_secret",
    "blocked_provider",
    "waived_by_user",
  ]);
});

test("Phase 0 harness can scope to one provider path", () => {
  assert.deepEqual(selectTargets({ provider: "jina", path: "extract" }), [
    { provider: "jina", path: "extract" },
  ]);
});

test("Phase 0 harness rejects unsupported provider paths", () => {
  assert.throws(
    () => selectTargets({ provider: "jina", path: "search" }),
    /No Phase 0 target matches provider=jina path=search/
  );
});
