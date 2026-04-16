import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { providerRegistry } from "../dist/providers.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CAPABILITIES = /** @type {const} */ (["search", "extract", "crawl"]);

function readUtf8(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse the "Dual Matrix" markdown table into a map keyed by provider displayName.
 * We treat ✅ and ⚠️ as "declared implemented" for ColdSearch.
 */
function parseCapabilityMatrixColdSearchSupport(matrixMarkdown) {
  const dualMatrixStart = matrixMarkdown.indexOf("## Dual Matrix");
  assert.ok(dualMatrixStart >= 0, "CAPABILITY_MATRIX.md missing '## Dual Matrix' section");

  const afterHeader = matrixMarkdown.slice(dualMatrixStart);

  const rows = afterHeader
    .split("\n")
    .filter((line) => /^\|\s*[^|]+\s*\|/.test(line))
    // drop header separator row
    .filter((line) => !/^\|\s*-{2,}/.test(line.trim()));

  assert.ok(rows.length >= 2, "Dual Matrix table not found or empty");

  const headerRow = rows[0];
  const headers = headerRow
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

  const coldSearchCols = {
    search: headers.indexOf("ColdSearch `search`"),
    extract: headers.indexOf("ColdSearch `extract`"),
    crawl: headers.indexOf("ColdSearch `crawl`"),
    provider: headers.indexOf("Provider"),
  };

  for (const [key, idx] of Object.entries(coldSearchCols)) {
    assert.ok(idx >= 0, `Dual Matrix header missing expected column for ${key}`);
  }

  /** @type {Record<string, Set<string>>} */
  const byDisplayName = {};

  for (const row of rows.slice(1)) {
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    const displayName = cells[coldSearchCols.provider];
    if (!displayName) continue;

    const support = new Set();
    for (const cap of CAPABILITIES) {
      const raw = cells[coldSearchCols[cap]];
      if (raw === "✅" || raw === "⚠️") {
        support.add(cap);
      }
    }
    byDisplayName[displayName] = support;
  }

  return byDisplayName;
}

function setEq(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

test("capability matrix, registry, and adapter method surfaces stay in sync", () => {
  const matrixMarkdown = readUtf8("docs/CAPABILITY_MATRIX.md");
  const byDisplayName = parseCapabilityMatrixColdSearchSupport(matrixMarkdown);

  for (const [providerName, metadata] of Object.entries(providerRegistry)) {
    const expected = byDisplayName[metadata.displayName];
    assert.ok(
      expected,
      `CAPABILITY_MATRIX.md missing provider row for '${metadata.displayName}' (${providerName})`
    );

    const registryCaps = new Set(metadata.capabilities);
    assert.ok(
      setEq(expected, registryCaps),
      [
        `Capability drift for '${providerName}' (${metadata.displayName})`,
        `- matrix:   [${[...expected].sort().join(", ")}]`,
        `- registry: [${[...registryCaps].sort().join(", ")}]`,
      ].join("\n")
    );

    const adapter = metadata.createAdapter();
    assert.ok(
      setEq(new Set(adapter.capabilities), registryCaps),
      [
        `Adapter capabilities drift for '${providerName}'`,
        `- adapter.capabilities:  [${[...new Set(adapter.capabilities)].sort().join(", ")}]`,
        `- registry.capabilities: [${[...registryCaps].sort().join(", ")}]`,
      ].join("\n")
    );

    for (const cap of CAPABILITIES) {
      if (!registryCaps.has(cap)) continue;
      assert.ok(
        typeof adapter[cap] === "function",
        `Adapter '${providerName}' must export '${cap}()' when declaring capability '${cap}'`
      );
    }

    // Ensure the matrix row contains the display name (sanity for parser)
    assert.match(
      matrixMarkdown,
      new RegExp(`\\|\\s*${escapeRegex(metadata.displayName)}\\s*\\|`),
      `CAPABILITY_MATRIX.md is missing a table row for '${metadata.displayName}'`
    );
  }
});

