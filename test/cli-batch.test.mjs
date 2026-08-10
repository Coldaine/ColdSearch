import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Provider hosts batch items dispatch to; redirected to the local mock. */
const PROVIDER_HOSTS = ["https://api.exa.ai", "https://api.tavily.com"];

function makeDir(tag = "coldsearch-batch-cli-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), tag));
}

/**
 * Start a local mock provider server. Routes by (method, path):
 * - POST /search    -> Exa search shape (also satisfies Tavily tool reads)
 * - POST /contents  -> Exa contents (extract / crawl contents)
 * Counts every request so tests can prove zero provider calls on cache hits
 * and resumed skips.
 */
function startMockServer() {
  const state = { requests: 0 };
  const server = http.createServer((req, res) => {
    state.requests += 1;
    const url = new URL(req.url, "http://127.0.0.1");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && url.pathname === "/search") {
      res.end(
        JSON.stringify({
          results: [
            { title: "Mock Title", url: "https://mock.example/1", text: "mock snippet", score: 0.9 },
          ],
          answer: "mock answer",
        })
      );
    } else if (req.method === "POST" && url.pathname === "/contents") {
      res.end(
        JSON.stringify({
          results: [{ url: "https://mock.example/page", title: "Mock Page", text: "mock body content" }],
        })
      );
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: `unexpected ${req.method} ${url.pathname}` }));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, state, port: typeof addr === "object" && addr ? addr.port : 0 });
    });
  });
}

/**
 * Write a preload module that redirects provider hosts to the mock server and
 * return the NODE_OPTIONS value to load it. The spawned CLI then dispatches
 * every provider call to the local mock — no real network calls. A `.cjs`
 * preload loaded via `--require` keeps this portable across Node 18+ (the
 * project's engine floor); `--import` would require Node >= 20.6.
 */
function preloadOptions(dir, port) {
  const preloadPath = path.join(dir, "mock-fetch.cjs");
  const hosts = JSON.stringify(PROVIDER_HOSTS);
  fs.writeFileSync(
    preloadPath,
    `const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  let u = typeof input === "string" ? input : input.toString();
  for (const host of ${hosts}) {
    u = u.split(host).join("http://127.0.0.1:${port}");
  }
  return originalFetch(u, init);
};
`,
    "utf8"
  );
  return `--require ${JSON.stringify(preloadPath)}`;
}

function writeConfig(dir, { cacheEnabled = false } = {}) {
  const configPath = path.join(dir, "config.toml");
  const cacheBlock = cacheEnabled
    ? `[cache]\nenabled = true\npath = ${JSON.stringify(path.join(dir, "cache"))}\n`
    : `[cache]\nenabled = false\n`;
  fs.writeFileSync(
    configPath,
    [
      "[capabilities.search]",
      'providers = ["exa"]',
      'strategy = "all"',
      "",
      "[capabilities.extract]",
      'providers = ["exa"]',
      'strategy = "all"',
      "",
      "[capabilities.crawl]",
      'providers = ["exa"]',
      'strategy = "all"',
      "",
      "[providers.exa]",
      "[providers.exa.keyPool]",
      'keys = ["env:EXA_API_KEY"]',
      "",
      "[providers.tavily]",
      "[providers.tavily.keyPool]",
      'keys = ["env:TAVILY_API_KEY"]',
      "",
      "[logging.usage]",
      `path = ${JSON.stringify(path.join(dir, "usage.jsonl"))}`,
      "",
      cacheBlock.trim(),
      "[history]",
      `path = ${JSON.stringify(path.join(dir, "history.jsonl"))}`,
    ]
      .join("\n")
      .trim() + "\n",
    "utf8"
  );
  return configPath;
}

/**
 * Async CLI spawn. The mock provider server lives in this test process, so the
 * parent event loop must stay free to accept the child's connections while the
 * CLI runs — `spawnSync` would block it and every provider call would hang.
 */
function runCli(args, nodeOptions) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["dist/cli.js", ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        EXA_API_KEY: "test-exa-key",
        TAVILY_API_KEY: "test-tavily-key",
        ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      },
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

function writeInput(dir, records) {
  const inputPath = path.join(dir, "in.jsonl");
  fs.writeFileSync(inputPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  return inputPath;
}

function outputRecords(outputPath) {
  return fs
    .readFileSync(outputPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
}

test("runs a mixed search/extract/crawl/provider-tool batch with mocked providers", async () => {
  const dir = makeDir();
  const { server, state, port } = await startMockServer();
  const nodeOptions = preloadOptions(dir, port);
  try {
    const inputPath = writeInput(dir, [
      { id: "search-1", capability: "search", query: "hello world", limit: 3 },
      { id: "extract-1", capability: "extract", url: "https://example.com/page" },
      { id: "crawl-1", capability: "crawl", url: "https://example.com", limit: 2 },
      { id: "tool-1", tool: "tavily.answer", input: { query: "hello world" } },
    ]);
    const outputPath = path.join(dir, "out.jsonl");
    const configPath = writeConfig(dir);

    const result = await runCli(
      ["batch", "--input", inputPath, "--output", outputPath, "--concurrency", "2", "--config", configPath, "--json"],
      nodeOptions
    );
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.command, "batch");
    assert.equal(out.executed, 4);
    assert.equal(out.succeeded, 4);
    assert.equal(out.failed, 0);
    assert.equal(out.conflicts, 0);

    const records = outputRecords(outputPath);
    assert.equal(records.length, 4, "one output line per processed record");
    const byId = Object.fromEntries(records.map((r) => [r.id, r]));
    assert.ok(records.every((r) => r.error === null), "all records succeeded");

    const search = byId["search-1"];
    assert.equal(search.status, "success");
    assert.ok(Array.isArray(search.result.results));
    assert.deepEqual(search.result.providers_used, ["exa"]);

    const extract = byId["extract-1"];
    assert.equal(extract.result.result.content, "mock body content");
    assert.equal(extract.result.provider, "exa");

    const crawl = byId["crawl-1"];
    assert.ok(Array.isArray(crawl.result.results));
    assert.ok(crawl.result.results.length >= 1);

    const tool = byId["tool-1"];
    assert.equal(tool.result.ok, true);
    assert.equal(tool.result.provider, "tavily");
    assert.equal(tool.result.tool, "answer");

    // search(1) + extract(1) + crawl(2: discover+contents) + tool(1)
    assert.ok(state.requests >= 5, `expected >= 5 provider requests, got ${state.requests}`);
    // Every batch item produced the same execution history as a standalone call.
    const history = fs
      .readFileSync(path.join(dir, "history.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
    assert.equal(history.length, 4, "one history record per executed item");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resumes a partial output file", async () => {
  const dir = makeDir();
  const { server, state, port } = await startMockServer();
  const nodeOptions = preloadOptions(dir, port);
  try {
    const inputPath = writeInput(dir, [
      { id: "a", capability: "search", query: "aa", limit: 3 },
      { id: "b", capability: "search", query: "bb", limit: 3 },
      { id: "c", capability: "search", query: "cc", limit: 3 },
    ]);
    const outputPath = path.join(dir, "out.jsonl");
    // Partial prior run: a succeeded, b errored, c never started.
    fs.writeFileSync(
      outputPath,
      [
        JSON.stringify({ id: "a", capability: "search", status: "success", result: { results: [], providers_used: ["exa"] }, error: null }),
        JSON.stringify({ id: "b", capability: "search", status: "error", result: null, error: { message: "transient failure" } }),
      ].join("\n") + "\n",
      "utf8"
    );
    const configPath = writeConfig(dir);

    // Run 1: without --retry-errors -> a and b are skipped, only c executes.
    const first = await runCli(
      ["batch", "--input", inputPath, "--output", outputPath, "--config", configPath, "--json"],
      nodeOptions
    );
    assert.equal(first.status, 0, first.stderr);
    const firstOut = JSON.parse(first.stdout);
    assert.equal(firstOut.executed, 1, "only c executed");
    assert.equal(firstOut.skipped, 2, "a (success) and b (error, no retry) skipped");
    assert.equal(state.requests, 1, "only c dispatched a provider call");
    let records = outputRecords(outputPath);
    assert.equal(records.length, 3);
    assert.equal(records.filter((r) => r.id === "a").length, 1, "a not re-appended");
    assert.equal(records.filter((r) => r.id === "c").length, 1);

    // Run 2: with --retry-errors -> b is retried; a (success) and c (success) skip.
    const second = await runCli(
      ["batch", "--input", inputPath, "--output", outputPath, "--config", configPath, "--json", "--retry-errors"],
      nodeOptions
    );
    assert.equal(second.status, 0, second.stderr);
    const secondOut = JSON.parse(second.stdout);
    assert.equal(secondOut.executed, 1, "only b re-executed");
    assert.equal(secondOut.skipped, 2);
    assert.equal(state.requests, 2, "only b re-dispatched a provider call");
    records = outputRecords(outputPath);
    assert.equal(records.length, 4);
    const bRecords = records.filter((r) => r.id === "b");
    assert.equal(bRecords.length, 2, "b keeps its error record and gains a success record");
    assert.equal(bRecords[0].status, "error");
    assert.equal(bRecords[1].status, "success");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("verifies duplicate conflicting IDs produce an error", async () => {
  const dir = makeDir();
  const { server, state, port } = await startMockServer();
  const nodeOptions = preloadOptions(dir, port);
  try {
    const inputPath = writeInput(dir, [
      { id: "d", capability: "search", query: "first", limit: 3 },
      { id: "d", capability: "search", query: "second", limit: 3 },
      { id: "e", capability: "search", query: "same", limit: 3 },
      { id: "e", capability: "search", query: "same", limit: 3 },
    ]);
    const outputPath = path.join(dir, "out.jsonl");
    const configPath = writeConfig(dir);

    const result = await runCli(
      ["batch", "--input", inputPath, "--output", outputPath, "--config", configPath, "--json"],
      nodeOptions
    );
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.executed, 2, "first occurrence of d and e");
    assert.equal(out.conflicts, 1, "conflicting d emits an error record");
    assert.equal(out.skipped, 1, "identical e duplicate skipped without output");
    assert.equal(state.requests, 2, "only the first occurrence of each id dispatches");

    const records = outputRecords(outputPath);
    assert.equal(records.length, 3);
    const dSuccess = records.find((r) => r.id === "d" && r.status === "success");
    const dConflict = records.find((r) => r.id === "d" && r.status === "error");
    assert.ok(dSuccess, "first d executes normally");
    assert.ok(dConflict, "conflicting d produces a visible error record");
    assert.equal(dConflict.error.code, "DUPLICATE_ID_CONFLICT");
    assert.equal(dConflict.result, null);
    assert.equal(records.filter((r) => r.id === "e").length, 1, "identical duplicate produces no output");
    assert.equal(records.find((r) => r.id === "e").status, "success");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("verifies batch search/extract/provider-tool records can use eligible cache behavior", async () => {
  const dir = makeDir();
  const { server, state, port } = await startMockServer();
  const nodeOptions = preloadOptions(dir, port);
  try {
    const inputPath = writeInput(dir, [
      { id: "s", capability: "search", query: "cached query", limit: 3 },
      { id: "x", capability: "extract", url: "https://example.com/cached" },
      { id: "t", tool: "exa.search", input: { query: "cached tool query", numResults: 3 } },
    ]);
    const configPath = writeConfig(dir, { cacheEnabled: true });

    // Run 1 (live) writes eligible cache entries.
    const firstOut = path.join(dir, "out1.jsonl");
    const first = await runCli(
      ["batch", "--input", inputPath, "--output", firstOut, "--config", configPath, "--json"],
      nodeOptions
    );
    assert.equal(first.status, 0, first.stderr);
    const requestsAfterFirst = state.requests;
    assert.ok(requestsAfterFirst >= 3, `expected >= 3 provider calls on the live run, got ${requestsAfterFirst}`);

    // Run 2 against a FRESH output file must replay from cache: zero provider calls.
    const secondOut = path.join(dir, "out2.jsonl");
    const second = await runCli(
      ["batch", "--input", inputPath, "--output", secondOut, "--config", configPath, "--json"],
      nodeOptions
    );
    assert.equal(second.status, 0, second.stderr);
    assert.equal(state.requests, requestsAfterFirst, "cached rerun must not call providers");

    const records = outputRecords(secondOut);
    assert.equal(records.length, 3);
    assert.ok(records.every((r) => r.status === "success"), "cache replays still succeed");
    assert.equal(records[0].result.results.length, 1, "search replayed from cache");
    assert.equal(records[1].result.result.content, "mock body content", "extract replayed from cache");
    assert.equal(records[2].result.ok, true, "tool replayed from cache");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("batch --dry-run reports planned records without any provider calls", async () => {
  const dir = makeDir();
  const { server, state, port } = await startMockServer();
  const nodeOptions = preloadOptions(dir, port);
  try {
    const inputPath = writeInput(dir, [
      { id: "s", capability: "search", query: "q", limit: 3 },
      { id: "t", tool: "tavily.answer", input: { query: "q" } },
    ]);
    const outputPath = path.join(dir, "out.jsonl");
    const configPath = writeConfig(dir);

    const result = await runCli(
      ["batch", "--input", inputPath, "--output", outputPath, "--config", configPath, "--dry-run", "--json"],
      nodeOptions
    );
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.dry_run, true);
    assert.equal(out.to_execute, 2);
    assert.equal(out.records.length, 2);
    assert.equal(out.records[0].action, "execute");
    assert.equal(out.records[1].tool, "tavily.answer");
    assert.equal(state.requests, 0, "dry run must not call providers");
    assert.equal(fs.existsSync(outputPath), false, "dry run writes no output");
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
