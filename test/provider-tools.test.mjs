import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeToolCall } from "../dist/tools/substrate.js";
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
        }
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
          }
        };

        process.env.EXA_API_KEY = "secret-exa-key-123";

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
