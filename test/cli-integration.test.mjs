import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeConfig(dir, toml) {
  const p = path.join(dir, "config.toml");
  fs.writeFileSync(p, toml, "utf8");
  return p;
}

function runCli(args, env = {}) {
  return spawnSync(process.execPath, ["dist/cli.js", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function runCliAsync(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["dist/cli.js", ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ status: code ?? 0, stdout, stderr }));
  });
}

test("cli search returns expected output shape (searxng via local server)", async () => {
  await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith("/search")) {
        res.writeHead(404);
        res.end("not found");
        return;
      }

      const payload = {
        results: [{ title: "A", url: "https://a.example", content: "aa", score: 0.9 }],
      };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") return reject(new Error("no address"));
      const baseUrl = `http://127.0.0.1:${addr.port}`;

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-"));
      const configPath = writeConfig(
        dir,
        `
[capabilities.search]
providers = ["searxng"]

[providers.searxng]
[providers.searxng.keyPool]
keys = []

[providers.searxng.options]
baseUrl = "${baseUrl}"
`.trim()
      );

      runCliAsync(["search", "--config", configPath, "--json", "hello"])
        .then((result) => {
          server.close(() => {
            try {
              assert.equal(result.status, 0, result.stderr);
              const out = JSON.parse(result.stdout);
              assert.equal(out.command, "search");
              assert.equal(out.query, "hello");
              assert.ok(Array.isArray(out.results));
              assert.deepEqual(out.providers_used, ["searxng"]);
            } catch (e) {
              reject(e);
              return;
            }
            fs.rmSync(dir, { recursive: true, force: true });
            resolve();
          });
        })
        .catch(reject);
    });
  });
});

test("--providers filters provider selection (avoids external provider calls)", () => {
  const result = withTempDir((dir) => {
    const configPath = writeConfig(
      dir,
      `
[capabilities.search]
providers = ["searxng", "brave"]

[providers.searxng]
[providers.searxng.keyPool]
keys = []

[providers.searxng.options]
baseUrl = "http://127.0.0.1:1"

[providers.brave]
[providers.brave.keyPool]
keys = ["k"]
`.trim()
    );

    return runCli(["search", "--config", configPath, "--providers", "searxng", "--json", "hello"]);
  });

  // We don't assert success (baseUrl is unreachable), only that the error is about the chosen provider.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /searxng/i);
  assert.doesNotMatch(result.stderr, /brave/i);
});

test("cli errors clearly on missing capability config", () => {
  const result = withTempDir((dir) => {
    const configPath = writeConfig(
      dir,
      `
[capabilities.search]
providers = ["searxng"]

[providers.searxng]
[providers.searxng.keyPool]
keys = []

[providers.searxng.options]
baseUrl = "http://127.0.0.1:1"
`.trim()
    );

    return runCli(["extract", "--config", configPath, "--json", "https://example.com"]);
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /No configuration found for capability: extract/i);
});

