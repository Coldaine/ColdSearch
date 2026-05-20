import test from "node:test";
import assert from "node:assert/strict";
import { rerank } from "../dist/engine/reranker.js";

function r(title, url, score, source) {
  return { title, url, snippet: title, score, source };
}

test("RRF reranking produces expected order", () => {
  const resultsByProvider = new Map([
    [
      "p1",
      [r("u1", "https://x.example/1", 0.9, "p1"), r("u2", "https://x.example/2", 0.8, "p1"), r("u3", "https://x.example/3", 0.7, "p1")],
    ],
    [
      "p2",
      [r("u2", "https://x.example/2", 0.2, "p2"), r("u3", "https://x.example/3", 0.3, "p2"), r("u1", "https://x.example/1", 0.1, "p2")],
    ],
  ]);

  const out = rerank(resultsByProvider, { strategy: "rrf", limit: 10, rrfK: 0 });
  assert.deepEqual(out.map((x) => x.url), [
    "https://x.example/2",
    "https://x.example/1",
    "https://x.example/3",
  ]);
});

test("score-based reranking dedupes by URL and keeps highest normalized score", () => {
  const resultsByProvider = new Map([
    ["p1", [r("a", "https://x.example/a", 10, "p1"), r("b", "https://x.example/b", 5, "p1")]],
    // overlapping URL with different casing/trailing slash should dedupe
    ["p2", [r("a2", "https://x.example/A/", 1, "p2")]],
  ]);

  const out = rerank(resultsByProvider, { strategy: "score", limit: 10 });
  assert.equal(out.length, 2);
  assert.equal(out[0].url.toLowerCase().replace(/\/$/, ""), "https://x.example/a");
});

test("deduplication by URL preserves highest-scored entry for 'none' strategy", () => {
  const resultsByProvider = new Map([
    ["p1", [r("low", "https://x.example/a", 0.1, "p1")]],
    ["p2", [r("high", "https://x.example/a/", 0.9, "p2")]],
  ]);

  const out = rerank(resultsByProvider, { strategy: "none", limit: 10 });
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "high");
});

test("limit truncates results", () => {
  const resultsByProvider = new Map([
    ["p1", [r("1", "https://x.example/1", 1, "p1"), r("2", "https://x.example/2", 0.5, "p1")]],
  ]);

  const out = rerank(resultsByProvider, { strategy: "none", limit: 1 });
  assert.equal(out.length, 1);
});

