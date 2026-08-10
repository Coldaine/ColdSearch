import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeToolCall } from "../dist/tools/substrate.js";
import { cacheKey } from "../dist/cache/key.js";
import { listToolProfiles, getToolProfile } from "../dist/registry/tool-profiles.js";

// Helper to write config and create temp directory
function withTempDirAndConfig(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-test-"));
  const configPath = path.join(dir, "config.toml");
  const usageLogPath = path.join(dir, "usage.jsonl");

  const toml = `
[capabilities.search]
providers = ["searxng"]

[providers.searxng]
[providers.searxng.keyPool]
keys = []
[providers.searxng.options]
baseUrl = "http://localhost:11111"

[providers.firecrawl]
[providers.firecrawl.keyPool]
keys = ["env:FIRECRAWL_API_KEY"]

[logging.usage]
path = "${usageLogPath.replaceAll("\\", "/")}"

[history]
path = "${path.join(dir, "history.jsonl").replaceAll("\\", "/")}"

[cache]
enabled = false
`.trim();

  fs.writeFileSync(configPath, toml, "utf8");

  try {
    return fn(dir, configPath, usageLogPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("registry lists catalogued provider tools", () => {
  const tools = listToolProfiles();
  assert.ok(tools.length > 10, "Expected at least 10 provider tools catalogued");
  
  const firecrawlScrape = getToolProfile("firecrawl.scrape");
  assert.ok(firecrawlScrape, "Expected firecrawl.scrape tool profile to be defined");
  assert.equal(firecrawlScrape.status, "wired");
});

test("unknown provider fails locally without a network call", async () => {
  const config = {
    capabilities: {},
    providers: {}, // No providers configured!
    history: { path: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-hist-")), "history.jsonl") },
  };
  
  const result = await executeToolCall("unknown-provider", "search", {}, config);
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "UNKNOWN_PROVIDER");
  assert.equal(result.raw, null);
});

test("hard-excluded tools fail locally without a network call", async () => {
  const config = {
    capabilities: {},
    providers: {
      firecrawl: {
        keyPool: { keys: ["env:FIRECRAWL_API_KEY"] }
      }
    },
    history: { path: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-hist-")), "history.jsonl") },
  };
  
  const result = await executeToolCall("firecrawl", "agent", {}, config);
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "HARD_EXCLUDED");
  assert.equal(result.raw, null);
});

test("uncatalogued tool on a known provider warns but forwards", async () => {
  await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => body += c);
      req.on("end", () => {
        assert.equal(req.url, "/v2/somenewtool");
        assert.equal(req.method, "POST");
        assert.equal(req.headers.authorization, "Bearer test-api-key");
        
        const payload = { success: true, custom: "data" };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      });
    });

    server.listen(0, "127.0.0.1", async () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") return reject(new Error("no server address"));
      
      const config = {
        capabilities: {},
        providers: {
          firecrawl: {
            keyPool: { keys: ["env:FIRECRAWL_API_KEY"] }
          }
        },
        logging: {
          usage: { path: path.join(os.tmpdir(), "usage.jsonl") }
        },
        history: { path: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-hist-")), "history.jsonl") },
        cache: { enabled: false }
      };

      // Set env var to bypass Doppler dependency in offline test
      process.env.FIRECRAWL_API_KEY = "test-api-key";

      // Monkey patch default url to hit local mock server
      const originalFetch = global.fetch;
      global.fetch = (input, init) => {
        const u = input.toString().replace("https://api.firecrawl.dev", `http://127.0.0.1:${addr.port}`);
        return originalFetch(u, init);
      };

      try {
        const result = await executeToolCall("firecrawl", "somenewtool", { input: 123 }, config);
        
        global.fetch = originalFetch;
        server.close(async () => {
          try {
            assert.equal(result.ok, true);
            assert.equal(result.catalogued, false);
            assert.deepEqual(result.raw, { success: true, custom: "data" });
            assert.deepEqual(result.meta.warnings, ["Tool 'firecrawl.somenewtool' is uncatalogued."]);
            resolve(null);
          } catch (e) {
            reject(e);
          }
        });
      } catch (err) {
        global.fetch = originalFetch;
        server.close(() => reject(err));
      }
    });
  });
});

function makeToolServer() {
  const counts = { search: 0, answer: 0 };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/search") {
        counts.search++;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            results: [{ title: "Strix Halo", url: "https://strix-halo.example", text: "..." }],
          })
        );
      } else if (req.url === "/answer") {
        counts.answer++;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ answer: "Strix Halo review summary", citations: [] }));
      } else {
        res.writeHead(404);
        res.end("not found");
      }
    });
  });
  return { server, counts };
}

function readHistory(path) {
  if (!fs.existsSync(path)) return [];
  return fs
    .readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("a replay-safe provider tool obeys --freshness and can produce an exact cache hit", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-replay-"));
  const cacheDir = path.join(dir, "cache");
  const historyPath = path.join(dir, "history.jsonl");
  const config = {
    capabilities: {},
    providers: { exa: { keyPool: { keys: ["env:EXA_API_KEY"] } } },
    cache: { enabled: true, path: cacheDir },
    history: { path: historyPath },
  };
  process.env.EXA_API_KEY = "test-exa-key";

  const { server, counts } = makeToolServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const originalFetch = global.fetch;
  global.fetch = (input, init) => {
    const u = input.toString().replace("https://api.exa.ai", `http://127.0.0.1:${server.address().port}`);
    return originalFetch(u, init);
  };

  try {
    const params = { query: "strix halo", numResults: 3 };
    const first = await executeToolCall("exa", "search", params, config, { freshness: "1h" });
    assert.equal(first.ok, true, first.error?.message);
    const callsAfterFirst = counts.search;

    const second = await executeToolCall("exa", "search", params, config, { freshness: "1h" });
    assert.equal(second.ok, true);
    assert.equal(counts.search, callsAfterFirst, "second identical call is served from exact replay cache");
    assert.deepEqual(second.raw, first.raw, "replayed payload matches the live result");

    const records = readHistory(historyPath);
    assert.equal(records.length, 2, "both live and replay invocations are recorded in history");
    assert.equal(records[0].source, "live");
    assert.equal(records[1].source, "cache");
    assert.equal(records[1].origin_execution_id, records[0].id, "replay links its origin execution");
    assert.deepEqual(records[1].attempts, [], "replay records zero provider calls");
    assert.ok(records[1].cache && typeof records[1].cache.age_seconds === "number");
  } finally {
    global.fetch = originalFetch;
    delete process.env.EXA_API_KEY;
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a provider tool without explicit replay eligibility is never served from exact replay cache", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-noreplay-"));
  const cacheDir = path.join(dir, "cache");
  const historyPath = path.join(dir, "history.jsonl");
  const config = {
    capabilities: {},
    providers: { exa: { keyPool: { keys: ["env:EXA_API_KEY"] } } },
    cache: { enabled: true, path: cacheDir },
    history: { path: historyPath },
  };
  process.env.EXA_API_KEY = "test-exa-key";

  const { server, counts } = makeToolServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const originalFetch = global.fetch;
  global.fetch = (input, init) => {
    const u = input.toString().replace("https://api.exa.ai", `http://127.0.0.1:${server.address().port}`);
    return originalFetch(u, init);
  };

  try {
    // exa.answer is LLM-synthesized output — deliberately not on the
    // replay-safe allowlist, even though it is catalogued and synchronous.
    const params = { query: "strix halo" };
    const first = await executeToolCall("exa", "answer", params, config, { freshness: "1h" });
    assert.equal(first.ok, true, first.error?.message);
    const callsAfterFirst = counts.answer;

    const second = await executeToolCall("exa", "answer", params, config, { freshness: "1h" });
    assert.equal(second.ok, true);
    assert.ok(counts.answer > callsAfterFirst, "non-eligible tool always executes live");
    assert.ok(
      second.meta.warnings.some((w) => w.includes("always executes live")),
      "ignored --freshness is surfaced as a warning"
    );

    const records = readHistory(historyPath);
    assert.equal(records.length, 2);
    assert.ok(records.every((r) => r.source === "live"), "no exact replay record for non-eligible tool");
    assert.ok(records.every((r) => r.attempts.length === 1));

    // Nothing was stored under the tool replay cache.
    const toolDir = path.join(cacheDir, "tool");
    const stored =
      fs.existsSync(toolDir) && fs.readdirSync(toolDir).length > 0;
    assert.equal(stored, false, "non-eligible tool results are never written to the replay cache");
  } finally {
    global.fetch = originalFetch;
    delete process.env.EXA_API_KEY;
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("raw provider payload and usage logging is preserved in tool calls", async () => {
  await withTempDirAndConfig(async (dir, configPath, usageLogPath) => {
    await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (c) => body += c);
        req.on("end", () => {
          assert.equal(req.url, "/somenewtool");
          const payload = { test: "raw-response-data" };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
        });
      });

      server.listen(0, "127.0.0.1", async () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") return reject(new Error("Address mismatch"));

        const config = {
          capabilities: {},
          providers: {
            exa: {
              keyPool: { keys: ["env:EXA_API_KEY"] }
            }
          },
          logging: {
            usage: { path: usageLogPath }
          },
          history: { path: path.join(dir, "history.jsonl") },
          cache: { enabled: false }
        };

        process.env.EXA_API_KEY = "test-exa-key";

        // Monkey patch default url to hit local mock server
        const originalFetch = global.fetch;
        global.fetch = (input, init) => {
          const u = input.toString().replace("https://api.exa.ai", `http://127.0.0.1:${addr.port}`);
          return originalFetch(u, init);
        };

        try {
          const result = await executeToolCall("exa", "somenewtool", {}, config);
          
          global.fetch = originalFetch;
          server.close(() => {
            try {
              assert.equal(result.ok, true);
              assert.deepEqual(result.raw, { test: "raw-response-data" });
              assert.equal(result.meta.safe_key_ref, "env:EXA_API_KEY");

              // Verify usage logging contains no raw API keys
              assert.ok(fs.existsSync(usageLogPath), "Usage log file must exist");
              const lines = fs.readFileSync(usageLogPath, "utf8").trim().split("\n");
              assert.equal(lines.length, 1);
              const logEntry = JSON.parse(lines[0]);
              assert.equal(logEntry.provider, "exa");
              assert.equal(logEntry.tool, "somenewtool");
              assert.equal(logEntry.success, true);
              assert.equal(logEntry.key, "env:EXA_API_KEY");
              
              resolve(null);
            } catch (e) {
              reject(e);
            }
          });
        } catch (e) {
          global.fetch = originalFetch;
          server.close(() => reject(e));
        }
      });
    });
  });
});

test("a malformed tool cache entry is a miss, and --freshness never persists into it", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-replay-"));
  const cacheDir = path.join(dir, "cache");
  const historyPath = path.join(dir, "history.jsonl");
  const config = {
    capabilities: {},
    providers: { exa: { keyPool: { keys: ["env:EXA_API_KEY"] } } },
    cache: { enabled: true, path: cacheDir },
    history: { path: historyPath },
  };
  process.env.EXA_API_KEY = "test-exa-key";

  const { server, counts } = makeToolServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const originalFetch = global.fetch;
  global.fetch = (input, init) => {
    const u = input.toString().replace("https://api.exa.ai", `http://127.0.0.1:${server.address().port}`);
    return originalFetch(u, init);
  };

  try {
    const params = { query: "strix halo", numResults: 3 };
    const key = cacheKey("tool", "exa.search", params);

    // Seed a well-formed entry shell with a malformed payload.
    const toolDir = path.join(cacheDir, "tool");
    fs.mkdirSync(toolDir, { recursive: true });
    fs.writeFileSync(
      path.join(toolDir, `${key}.json`),
      JSON.stringify({ key, payload: { bogus: true }, created_at: Date.now(), ttl_seconds: 21600 })
    );

    const result = await executeToolCall("exa", "search", params, config, { freshness: "1h" });
    assert.equal(result.ok, true, "malformed entry is bypassed with a live call");
    assert.equal(counts.search, 1, "provider was called live");

    // The --freshness override must not persist into the stored entry.
    const stored = JSON.parse(fs.readFileSync(path.join(toolDir, `${key}.json`), "utf8"));
    assert.equal(stored.ttl_seconds, 21600, "stored entry keeps the config TTL, not the override");
  } finally {
    global.fetch = originalFetch;
    delete process.env.EXA_API_KEY;
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
