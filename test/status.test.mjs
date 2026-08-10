import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDoctorReport, buildStatus } from "../dist/status.js";

/** Minimal keyless provider config that passes `config doctor` cleanly. */
function representativeConfig(dir) {
  return {
    capabilities: {
      search: { providers: ["searxng"], strategy: "random" },
      extract: { providers: [], strategy: "random" },
      crawl: { providers: [], strategy: "random" },
    },
    providers: {
      searxng: {
        keyPool: { keys: [] },
        options: { baseUrl: "https://search.example.internal" },
      },
    },
    cache: { path: path.join(dir, "cache") },
    logging: { usage: { path: path.join(dir, "usage.jsonl") } },
  };
}

test("doctor and status never invoke fetch (zero-network guard)", (t) => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    throw new Error("unexpected network call from doctor/status");
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-status-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const config = representativeConfig(dir);
  const configPath = path.join(dir, "config.toml");

  const report = buildDoctorReport(config, configPath);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);

  const status = buildStatus(config, configPath);
  assert.equal(status.config_path, configPath);

  assert.deepEqual(calls, [], "doctor/status must never make network calls");
});
