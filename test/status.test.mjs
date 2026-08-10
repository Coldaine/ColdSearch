import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDoctorReport, buildStatus } from "../dist/status.js";
import { loadConfig } from "../dist/config.js";

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

test("status summary is correct for a usage log larger than the read window", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-status-"));
  try {
    const usagePath = path.join(dir, "usage.jsonl");
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    const stale = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const line = (provider, timestamp) =>
      JSON.stringify({ timestamp, provider, success: true, key: "k", response_time_ms: 1 });

    // > 2 MB of recent filler so the file exceeds the tail read window.
    const filler = Array.from({ length: 60000 }, () => line("bulk", recent)).join("\n");
    fs.writeFileSync(usagePath, `${filler}\n`);
    // Probe entries, then one entry older than the 7-day cutoff.
    const tail = [
      line("probe", recent),
      line("probe", recent),
      line("probe", recent),
      line("stale", stale),
    ].join("\n");
    fs.appendFileSync(usagePath, `${tail}\n`);
    assert.ok(fs.statSync(usagePath).size > 2 * 1024 * 1024, "fixture must exceed the window");

    const status = buildStatus(representativeConfig(dir), path.join(dir, "config.toml"));
    const summary = status.recent_usage_summary_7d;
    assert.ok(summary, "summary must be present");
    assert.deepEqual(summary.probe, { calls: 3, successes: 3, success_rate: 1 });
    // The 5000-line cap applies inside the tail window; the last 5000 lines
    // include the 4 appended tail lines, leaving 4996 bulk entries.
    assert.equal(summary.bulk.calls, 4996);
    assert.equal(summary.stale, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("doctor validates [agent.llm]: provider, base_url, and model", () => {
  const withLlm = (overrides) => ({
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
    agent: {
      llm: {
        provider: "openai",
        model: "gpt-4o",
        baseUrl: "https://api.openai.com/v1",
        ...overrides,
      },
    },
  });
  const errorMessages = (config) =>
    buildDoctorReport(config, "/tmp/config.toml").errors.map((e) => e.message).join("\n");

  // A well-formed [agent.llm] adds no errors.
  assert.deepEqual(buildDoctorReport(withLlm({}), "/tmp/config.toml").errors, []);

  assert.match(errorMessages(withLlm({ provider: "anthropic" })), /\[agent\.llm\] provider must be one of/);
  assert.match(errorMessages(withLlm({ baseUrl: "not-a-url" })), /\[agent\.llm\] base_url must be a valid http\(s\) URL/);
  assert.match(errorMessages(withLlm({ baseUrl: 123 })), /\[agent\.llm\] base_url/);
  assert.match(errorMessages(withLlm({ model: "" })), /\[agent\.llm\] model must be a non-empty string/);
});

test("loadConfig survives a non-table [agent.llm] and doctor flags it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coldsearch-status-"));
  try {
    const configPath = path.join(dir, "config.toml");
    fs.writeFileSync(
      configPath,
      `
[capabilities.search]
providers = []

[providers]

[agent]
llm = "just-a-string"
`.trim() + "\n",
      "utf8"
    );

    const config = loadConfig(configPath); // must not throw
    const report = buildDoctorReport(config, configPath);
    assert.equal(report.valid, false);
    assert.match(
      report.errors.map((e) => e.message).join("\n"),
      /\[agent\.llm\] must be a table/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
