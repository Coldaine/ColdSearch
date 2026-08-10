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

test("doctor never echoes the SearXNG baseUrl value in errors", () => {
  const report = buildDoctorReport(
    {
      capabilities: {
        search: { providers: ["searxng"], strategy: "random" },
        extract: { providers: [], strategy: "random" },
        crawl: { providers: [], strategy: "random" },
      },
      providers: {
        searxng: {
          keyPool: { keys: [] },
          options: { baseUrl: "sk-super-secret-abc" },
        },
      },
    },
    "/tmp/config.toml"
  );

  assert.equal(report.valid, false);
  const messages = [...report.errors, ...report.warnings]
    .map((issue) => issue.message)
    .join("\n");
  assert.match(messages, /baseUrl/);
  assert.doesNotMatch(messages, /sk-super-secret-abc/);
});

test("doctor skips the no-key warning when defaultSecretName is set", () => {
  const withDefault = buildDoctorReport(
    {
      capabilities: { search: { providers: ["tavily"], strategy: "random" } },
      providers: {
        tavily: { keyPool: { keys: [], defaultSecretName: "TAVILY_API_KEY" } },
      },
    },
    "/tmp/config.toml"
  );
  assert.doesNotMatch(
    withDefault.warnings.map((w) => w.message).join("\n"),
    /no key references configured/
  );

  // Control: a bare empty key pool still warns.
  const withoutDefault = buildDoctorReport(
    {
      capabilities: { search: { providers: ["tavily"], strategy: "random" } },
      providers: { tavily: { keyPool: { keys: [] } } },
    },
    "/tmp/config.toml"
  );
  assert.match(
    withoutDefault.warnings.map((w) => w.message).join("\n"),
    /no key references configured/
  );
});
