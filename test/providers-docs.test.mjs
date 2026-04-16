import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { providerRegistry } from "../dist/providers.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const capabilityMatrix = fs.readFileSync(
  path.join(repoRoot, "docs", "CAPABILITY_MATRIX.md"),
  "utf8"
);
const providerIndex = fs.readFileSync(
  path.join(repoRoot, "docs", "providers", "README.md"),
  "utf8"
);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CAPABILITIES = /** @type {const} */ (["search", "extract", "crawl"]);

function readProviderDoc(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function parseCapabilityMatrixColdSearchSupport(matrixMarkdown) {
  const dualMatrixStart = matrixMarkdown.indexOf("## Dual Matrix");
  assert.ok(dualMatrixStart >= 0, "CAPABILITY_MATRIX.md missing '## Dual Matrix' section");

  const afterHeader = matrixMarkdown.slice(dualMatrixStart);
  const rows = afterHeader
    .split("\n")
    .filter((line) => /^\|\s*[^|]+\s*\|/.test(line))
    .filter((line) => !/^\|\s*-{2,}/.test(line.trim()));

  assert.ok(rows.length >= 2, "Dual Matrix table not found or empty");

  const headers = rows[0]
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

  const idxProvider = headers.indexOf("Provider");
  const idxSearch = headers.indexOf("ColdSearch `search`");
  const idxExtract = headers.indexOf("ColdSearch `extract`");
  const idxCrawl = headers.indexOf("ColdSearch `crawl`");
  assert.ok(idxProvider >= 0 && idxSearch >= 0 && idxExtract >= 0 && idxCrawl >= 0, "Dual Matrix headers changed");

  /** @type {Record<string, Set<string>>} */
  const byDisplayName = {};

  for (const row of rows.slice(1)) {
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    const displayName = cells[idxProvider];
    if (!displayName) continue;

    const support = new Set();
    const vals = {
      search: cells[idxSearch],
      extract: cells[idxExtract],
      crawl: cells[idxCrawl],
    };

    for (const cap of CAPABILITIES) {
      if (vals[cap] === "✅" || vals[cap] === "⚠️") support.add(cap);
    }
    byDisplayName[displayName] = support;
  }

  return byDisplayName;
}

function findSection(markdown, headingText) {
  return new RegExp(`^##\\s+${escapeRegex(headingText)}\\s*$`, "m").test(markdown);
}

function parseCapabilitiesTableFromProviderDoc(markdown) {
  const sectionStart = markdown.search(/^##\s+Capabilities\s*$/m);
  assert.ok(sectionStart >= 0, "missing '## Capabilities' section");

  const after = markdown.slice(sectionStart);
  const lines = after.split("\n");

  // Find first markdown table after the heading
  const tableStart = lines.findIndex((line) => /^\|\s*Capability\s*\|/i.test(line));
  assert.ok(tableStart >= 0, "missing capabilities table header row under '## Capabilities'");
  assert.ok(/^\|\s*-{2,}/.test((lines[tableStart + 1] || "").trim()), "missing capabilities table separator row");

  const rows = [];
  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\|/.test(line)) break;
    rows.push(line);
  }

  /** @type {Record<string, { coldsearch: string }>} */
  const byCap = {};
  for (const row of rows) {
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 3) continue;
    const cap = cells[0].replace(/`/g, "").toLowerCase();
    if (!CAPABILITIES.includes(cap)) continue;
    const coldsearch = cells[2];
    byCap[cap] = { coldsearch };
  }

  return byCap;
}

function parseProvidersReadmeTable(markdown) {
  const lines = markdown.split("\n");
  const headerIdx = lines.findIndex((l) => /^\|\s*Provider\s*\|\s*File\s*\|/i.test(l));
  assert.ok(headerIdx >= 0, "docs/providers/README.md missing providers table header");
  assert.ok(/^\|\s*-{2,}/.test((lines[headerIdx + 1] || "").trim()), "docs/providers/README.md missing providers table separator");

  /** @type {Array<{ provider: string; status: string; notes: string }>} */
  const rows = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\|/.test(line)) break;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    rows.push({ provider: cells[0], status: cells[2], notes: cells[3] });
  }
  return rows;
}

test("every registered provider has a detail page", () => {
  for (const [provider, metadata] of Object.entries(providerRegistry)) {
    const providerDoc = path.join(repoRoot, metadata.docsPath);
    assert.ok(fs.existsSync(providerDoc), `missing provider doc for ${provider}`);
  }
});

test("capability matrix contains every registered provider", () => {
  for (const metadata of Object.values(providerRegistry)) {
    assert.match(
      capabilityMatrix,
      new RegExp(`\\|\\s*${escapeRegex(metadata.displayName)}\\s*\\|`)
    );
  }
});

test("provider index mentions every registered provider", () => {
  for (const metadata of Object.values(providerRegistry)) {
    assert.match(providerIndex, new RegExp(escapeRegex(metadata.displayName)));
  }
});

test("each provider doc contains required sections", () => {
  for (const [provider, metadata] of Object.entries(providerRegistry)) {
    const md = readProviderDoc(metadata.docsPath);
    for (const required of ["Overview", "Capabilities", "Configuration Example", "Authentication"]) {
      assert.ok(
        findSection(md, required),
        `docs/providers/${provider}.md missing required section: '## ${required}'`
      );
    }
  }
});

test("provider docs capability tables match central CAPABILITY_MATRIX.md", () => {
  const matrixSupport = parseCapabilityMatrixColdSearchSupport(capabilityMatrix);

  for (const [provider, metadata] of Object.entries(providerRegistry)) {
    const expected = matrixSupport[metadata.displayName];
    assert.ok(expected, `CAPABILITY_MATRIX.md missing provider row for '${metadata.displayName}' (${provider})`);

    const md = readProviderDoc(metadata.docsPath);
    const table = parseCapabilitiesTableFromProviderDoc(md);

    const declared = new Set();
    for (const cap of CAPABILITIES) {
      const symbol = table[cap]?.coldsearch;
      assert.ok(symbol, `${metadata.docsPath} Capabilities table missing row for '${cap}'`);
      if (symbol === "✅" || symbol === "⚠️") declared.add(cap);
    }

    assert.deepEqual(
      [...declared].sort(),
      [...expected].sort(),
      [
        `Capability drift between provider doc and CAPABILITY_MATRIX.md for '${provider}'`,
        `- provider doc: [${[...declared].sort().join(", ")}]`,
        `- matrix:        [${[...expected].sort().join(", ")}]`,
      ].join("\n")
    );
  }
});

test("docs/providers/README.md status fields reflect actual implementation state", () => {
  const rows = parseProvidersReadmeTable(providerIndex);
  const byDisplay = new Map(rows.map((r) => [r.provider, r]));

  for (const metadata of Object.values(providerRegistry)) {
    const row = byDisplay.get(metadata.displayName);
    assert.ok(row, `docs/providers/README.md missing row for '${metadata.displayName}'`);

    const caps = new Set(metadata.capabilities);
    const expectedStatus = caps.size === 3 ? "complete" : "partial";
    assert.equal(
      row.status,
      expectedStatus,
      `docs/providers/README.md status for '${metadata.displayName}' should be '${expectedStatus}'`
    );

    // Notes should mention the implemented capabilities in a human-readable list.
    for (const cap of caps) {
      assert.match(
        row.notes,
        new RegExp(`\\b${escapeRegex(cap)}\\b`),
        `docs/providers/README.md notes for '${metadata.displayName}' should mention '${cap}'`
      );
    }
  }
});
