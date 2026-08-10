import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts", "provider-pass-through.mjs");
const baselineDir = path.join(
  repoRoot,
  "plans",
  "evidence",
  "2026-06-23-provider-pass-through"
);
const protectedFiles = ["results.jsonl", "summary.md"];

function runScript(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

test("scoped run without --out-dir refuses to overwrite the committed baseline", () => {
  const before = Object.fromEntries(
    protectedFiles.map((file) => [
      file,
      fs.readFileSync(path.join(baselineDir, file), "utf8"),
    ])
  );

  const result = runScript(["--provider", "brave"]);

  assert.notEqual(result.status, 0, "expected a non-zero exit code");
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /baseline/i, "expected the refusal to mention the baseline");
  assert.match(output, /--out-dir/, "expected the refusal to mention --out-dir");

  for (const file of protectedFiles) {
    const after = fs.readFileSync(path.join(baselineDir, file), "utf8");
    assert.equal(after, before[file], `${file} must be untouched`);
  }
});

test("--help exits successfully and documents --overwrite-baseline", () => {
  const result = runScript(["--help"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--overwrite-baseline/);
  assert.match(result.stdout, /--out-dir/);
});

test("scoped run with --overwrite-baseline still refuses without --all", () => {
  const before = fs.readFileSync(path.join(baselineDir, "results.jsonl"), "utf8");

  const result = runScript(["--provider", "brave", "--overwrite-baseline"]);

  assert.notEqual(result.status, 0, "expected a non-zero exit code");
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /--all/, "expected the refusal to require --all");
  assert.equal(
    fs.readFileSync(path.join(baselineDir, "results.jsonl"), "utf8"),
    before,
    "baseline must be untouched"
  );
});

test("out-dir nested inside the baseline is refused", () => {
  const nested = path.join(baselineDir, "tmp-nested-guard-test");

  const result = runScript(["--provider", "brave", "--out-dir", nested]);

  assert.notEqual(result.status, 0, "expected a non-zero exit code");
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /baseline/i, "expected the refusal to mention the baseline");
  assert.equal(
    fs.existsSync(nested),
    false,
    "no nested directory may be created inside the baseline"
  );
});

test("--overwrite-baseline flag parses without network in --list mode", () => {
  const result = runScript(["--list", "--overwrite-baseline"]);

  assert.equal(result.status, 0, result.stderr);
});
