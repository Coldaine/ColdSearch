import assert from "node:assert/strict";

const CAPABILITIES = /** @type {const} */ (["search", "extract", "crawl"]);

/**
 * Parse only the first markdown table under "## Dual Matrix" (ignore later tables).
 */
export function parseCapabilityMatrixColdSearchSupport(matrixMarkdown) {
  const dualMatrixStart = matrixMarkdown.indexOf("## Dual Matrix");
  assert.ok(dualMatrixStart >= 0, "CAPABILITY_MATRIX.md missing '## Dual Matrix' section");

  const lines = matrixMarkdown.slice(dualMatrixStart).split("\n");
  const tableLines = [];

  for (const line of lines) {
    if (/^\|\s*[^|]+\s*\|/.test(line)) {
      tableLines.push(line);
      continue;
    }
    if (tableLines.length > 0) {
      break;
    }
  }

  const rows = tableLines.filter((line) => !/^\|\s*-{2,}/.test(line.trim()));
  assert.ok(rows.length >= 2, "Dual Matrix table not found or empty");

  const headers = rows[0]
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
