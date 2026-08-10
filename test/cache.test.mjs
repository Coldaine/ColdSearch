import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CacheStore } from "../dist/cache/cache.js";
import { cacheKey, parseDuration } from "../dist/cache/key.js";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "coldsearch-cache-"));
}

test("set then get returns the stored value", () => {
  const dir = makeTempDir();
  try {
    const store = new CacheStore({ path: dir });
    const key = cacheKey("search", "q", { limit: 10, rerankStrategy: "rrf" });
    const payload = { results: [{ url: "https://x.example" }], providersUsed: ["brave"], errors: {} };

    store.set("search", key, payload, 3600);
    const got = store.get("search", key);

    assert.deepEqual(got, payload);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an entry past its TTL is still readable; freshness is the caller's decision", () => {
  const dir = makeTempDir();
  try {
    const store = new CacheStore({ path: dir });
    const key = cacheKey("search", "q", {});

    // Hand-write an entry whose created_at is well past its TTL window.
    const capDir = join(dir, "search");
    mkdirSync(capDir, { recursive: true });
    const expired = {
      key,
      payload: { stale: true },
      created_at: Date.now() - 10_000 * 1000,
      ttl_seconds: 1,
    };
    writeFileSync(join(capDir, `${key}.json`), JSON.stringify(expired), "utf8");

    // The store does not evict at read time: a per-invocation --freshness
    // override may WIDEN the accepted window, which read-time eviction would
    // make impossible. Callers enforce freshness via isFresh.
    const got = store.getEntry("search", key);
    assert.ok(got, "expired entries remain readable");
    assert.deepEqual(got.payload, { stale: true });
    assert.equal(store.stats().expired_entries, 1, "stats still reports it expired");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing file returns null", () => {
  const dir = makeTempDir();
  try {
    const store = new CacheStore({ path: dir });
    assert.equal(store.get("search", "does-not-exist"), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a corrupt JSON file returns null without throwing", () => {
  const dir = makeTempDir();
  try {
    const store = new CacheStore({ path: dir });
    const key = "corrupt";
    const capDir = join(dir, "extract");
    mkdirSync(capDir, { recursive: true });
    writeFileSync(join(capDir, `${key}.json`), "{ not valid json", "utf8");

    assert.equal(store.get("extract", key), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("disabled store: get returns null and set is a no-op", () => {
  const dir = makeTempDir();
  try {
    const store = new CacheStore({ enabled: false, path: dir });
    const key = cacheKey("search", "q", {});
    store.set("search", key, { a: 1 }, 3600);

    assert.equal(store.get("search", key), null);
    assert.equal(existsSync(join(dir, "search", `${key}.json`)), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseDuration handles unit suffixes, bare numbers, and fallback", () => {
  assert.equal(parseDuration("6h"), 21600);
  assert.equal(parseDuration("24h"), 86400);
  assert.equal(parseDuration("30m"), 1800);
  assert.equal(parseDuration("45s"), 45);
  assert.equal(parseDuration("2d"), 172800);
  assert.equal(parseDuration("90"), 90); // bare number => seconds
  assert.equal(parseDuration("garbage", 99), 99); // fallback
  assert.equal(parseDuration("", 7), 7); // fallback
  // Numeric input (TOML bare number) is treated as seconds, not rejected.
  assert.equal(parseDuration(21600), 21600);
  assert.equal(parseDuration(0, 5), 5); // zero => fallback
  assert.equal(parseDuration(-10, 5), 5); // negative => fallback
});

test("non-string [cache].path does not throw (falls back to default)", () => {
  // loadConfig() returns unvalidated TOML; a non-string path must not crash.
  assert.doesNotThrow(() => new CacheStore({ path: 123 }));
  assert.doesNotThrow(() => new CacheStore({ path: ["a"] }));
});

test("cacheKey is stable across option key order and provider-agnostic", () => {
  const a = cacheKey("search", "q", { limit: 10, rerankStrategy: "rrf" });
  const b = cacheKey("search", "q", { rerankStrategy: "rrf", limit: 10 });
  assert.equal(a, b);

  // sha256 hex is 64 chars.
  assert.match(a, /^[0-9a-f]{64}$/);

  // Different query => different key.
  assert.notEqual(a, cacheKey("search", "other", { limit: 10, rerankStrategy: "rrf" }));
});
