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
