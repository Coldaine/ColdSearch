import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { providerRegistry } from "../dist/providers.js";
import { parseCapabilityMatrixColdSearchSupport } from "./_dual-matrix.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAPABILITIES = /** @type {const} */ (["search", "extract", "crawl"]);

function readUtf8(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setEq(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

test("capability matrix, registry, and adapter method surfaces stay in sync", () => {
  const matrixMarkdown = readUtf8("docs/PROVIDERS.md");
  const byDisplayName = parseCapabilityMatrixColdSearchSupport(matrixMarkdown);

  for (const [providerName, metadata] of Object.entries(providerRegistry)) {
    const expected = byDisplayName[metadata.displayName];
    assert.ok(
      expected,
      `PROVIDERS.md missing provider row for '${metadata.displayName}' (${providerName})`
    );

    const registryCaps = new Set(metadata.capabilities);
    assert.ok(
      setEq(expected, registryCaps),
      [
        `Capability drift for '${providerName}' (${metadata.displayName})`,
        `- matrix:   [${[...expected].sort((a, b) => a.localeCompare(b)).join(", ")}]`,
        `- registry: [${[...registryCaps].sort((a, b) => a.localeCompare(b)).join(", ")}]`,
      ].join("\n")
    );

    const adapter = metadata.createAdapter();
    assert.ok(
      setEq(new Set(adapter.capabilities), registryCaps),
      [
        `Adapter capabilities drift for '${providerName}'`,
        `- adapter.capabilities:  [${[...new Set(adapter.capabilities)].sort((a, b) => a.localeCompare(b)).join(", ")}]`,
        `- registry.capabilities: [${[...registryCaps].sort((a, b) => a.localeCompare(b)).join(", ")}]`,
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
      `PROVIDERS.md is missing a table row for '${metadata.displayName}'`
    );
  }
});

