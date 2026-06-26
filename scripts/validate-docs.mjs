import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  ALLOWED_STATUSES,
  REQUIRED_PROVIDER_PATHS,
} from "./provider-pass-through.mjs";

const root = process.cwd();
const failures = [];

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    fail(`Unable to read ${relativePath}: ${error.message}`);
    return "";
  }
}

function fail(message) {
  failures.push(message);
}

async function requireFile(relativePath) {
  if (!(await exists(relativePath))) {
    fail(`Missing required file: ${relativePath}`);
  }
}

async function requireAbsentFile(relativePath) {
  if (await exists(relativePath)) {
    fail(`Removed file should not exist: ${relativePath}`);
  }
}

function canonicalText(text) {
  return `${text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n*$/, "")}\n`;
}

function sha256(text) {
  return createHash("sha256").update(canonicalText(text), "utf8").digest("hex");
}

async function readJsonl(relativePath) {
  const text = await read(relativePath);
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        fail(`${relativePath}:${index + 1} is not valid JSON: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

async function walk(dir, files = []) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relativePath = path.join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      await walk(relativePath, files);
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

const planFiles = [
  "plans/2026-06-22-pr1-provider-tool-surface.md",
  "plans/2026-06-22-pr2-cache-a2.md",
  "plans/2026-06-22-pr3-batch-runner.md",
  "plans/2026-06-22-pr4-config-status-ux.md",
  "plans/2026-06-22-pr5-agent-run-ids.md",
];

for (const file of [
  "plans/2026-06-22-remaining-implementation-master-plan.md",
  ...planFiles,
  "plans/2026-06-22-epic-5-remote-agentic-execution.md",
  "docs/NORTH_STAR.md",
  "docs/NORTH_STAR.lock.sha256",
  "docs/architecture.md",
  "docs/PROVIDERS.md",
]) {
  await requireFile(file);
}

for (const removedDoc of ["docs/CONFIGURATION.md", "docs/BWS_INTEGRATION.md"]) {
  await requireAbsentFile(removedDoc);
}

if (await exists("docs/NORTH_STAR.lock.sha256")) {
  const northStar = await read("docs/NORTH_STAR.md");
  const lock = (await read("docs/NORTH_STAR.lock.sha256")).trim().split(/\s+/)[0];
  const actual = sha256(northStar);
  if (!/^[a-f0-9]{64}$/.test(lock)) {
    fail("docs/NORTH_STAR.lock.sha256 must contain a SHA-256 hex digest.");
  } else if (actual !== lock) {
    fail(`docs/NORTH_STAR.md does not match docs/NORTH_STAR.lock.sha256. Expected ${lock}, got ${actual}.`);
  }
}

const master = await read("plans/2026-06-22-remaining-implementation-master-plan.md");
const pr1 = await read("plans/2026-06-22-pr1-provider-tool-surface.md");
for (const file of planFiles) {
  const basename = path.basename(file);
  if (!master.includes(basename)) {
    fail(`Master plan does not link ${basename}`);
  }
}

if (!master.includes("PR 1 Phase 0: Provider Pass-Through Proof")) {
  fail("Master plan is missing PR 1 Phase 0 provider pass-through proof.");
}

if (/\]\(\.\/2026-06-23-gate-0-provider-pass-through-proof\.md\)/.test(master)) {
  fail("Master plan still links the deleted standalone Gate 0 plan.");
}

if (!master.includes("Historical/scratch planning cleanup")) {
  fail("Master plan must summarize deleted or superseded planning artifacts.");
}

if (!pr1.includes("## Phase 0: Provider Pass-Through Proof And Tool Discovery")) {
  fail("PR 1 plan must include Phase 0 provider pass-through proof and tool discovery.");
}

if (!pr1.includes("provider-native") || !pr1.includes("ColdSearch")) {
  fail("PR 1 Phase 0 must require provider-native vs ColdSearch comparison.");
}

if (!pr1.includes("Agentic testing") && !pr1.includes("Agent mode")) {
  fail("PR 1 Phase 0 must explicitly exclude agentic testing or agent mode as proof.");
}

if (!pr1.includes("official MCP/CLI source")) {
  fail("PR 1 Phase 0 must carry forward provider MCP/CLI source review as discovery input.");
}

if (!pr1.includes("Pass-Through Parity Requirement")) {
  fail("PR 1 plan must include the pass-through parity requirement.");
}

if (!pr1.includes("provider-native") || !pr1.includes("coldsearch tool call")) {
  fail("PR 1 plan must require provider-native vs coldsearch tool call evidence.");
}

if (!master.includes("Non-Negotiable PR Review Pause")) {
  fail("Master plan is missing the non-negotiable review pause.");
}

if (/four PRs fit/i.test(master)) {
  fail("Master plan still claims four PRs fit.");
}

if (/Vendor-specific tool and vertical expansion/i.test(master)) {
  fail("Master plan still defers provider-tool expansion generically.");
}

for (const file of planFiles) {
  const text = await read(file);
  for (const section of ["## Scope", "## Tasks", "## Required Tests", "## Validation", "## Success Criteria", "## PR Review Pause"]) {
    if (!text.includes(section)) {
      fail(`${file} is missing ${section}`);
    }
  }
  // Scope the contract check to the body of the `## Validation` section
  // (stop at the next `##`/`#` heading) so an `Expected:`/`What these prove:`
  // appearing in a later section like `## Success Criteria` can't satisfy it.
  const validationSection = (text.match(/## Validation\b([\s\S]*?)(?=\n#{1,2} |$)/) || [])[1] || "";
  if (!/\bWhat these prove:/.test(validationSection) || !/\bExpected:/.test(validationSection)) {
    fail(`${file} must explain what its validation proves: include a "What these prove:" and an "Expected:" block inside its ## Validation section.`);
  }
  if (!/Do not start PR \d+ until PR \d+ is merged unless the user explicitly authorizes parallel work/.test(text) && !/Merge PR 5 only after/.test(text)) {
    fail(`${file} does not enforce the review pause before the next PR.`);
  }
}

const docsAndPlans = [
  ...(await walk("docs")),
  ...(await walk("plans")),
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
].filter((file) => file.endsWith(".md"));

const referenceFiles = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "package.json",
  "config.example.toml",
]);
for (const dir of ["docs", "plans", "src", "scripts", "test"]) {
  if (await exists(dir)) {
    for (const file of await walk(dir)) {
      if (/\.(md|ts|js|mjs|json|toml)$/.test(file)) {
        referenceFiles.add(file);
      }
    }
  }
}

for (const file of referenceFiles) {
  if (file === "scripts/validate-docs.mjs") {
    continue;
  }
  const text = await read(file);
  for (const removedDoc of ["docs/CONFIGURATION.md", "docs/BWS_INTEGRATION.md"]) {
    if (text.includes(removedDoc)) {
      fail(`${file} still references removed file ${removedDoc}.`);
    }
  }
}

for (const file of docsAndPlans) {
  const text = await read(file);
  if (text.includes("docs/PROGRESS.md") || text.includes("PROGRESS.md")) {
    fail(`${file} still references deleted PROGRESS.md.`);
  }
  if (/PR1[–-]PR4/.test(text)) {
    fail(`${file} still references PR1-PR4 as the active sequence.`);
  }
}

const architecture = await read("docs/architecture.md");
if (!architecture.includes("| Remote / hybrid worker implementation | Deferred |")) {
  fail("architecture.md must mark remote/hybrid worker implementation as Deferred.");
}

const rootEntries = await readdir(root);
// Config files that legitimately live at the repo root. The rule targets stray
// research/result JSON dumps, not tooling config.
const allowedRootJson = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "renovate.json",
]);
const rootResearchJson = rootEntries.filter(
  (name) => name.endsWith(".json") && !allowedRootJson.has(name)
);
if (rootResearchJson.length > 0) {
  fail(`Research JSON artifacts should not live at repo root: ${rootResearchJson.join(", ")}`);
}

const queryTokenPatterns = [
  /([?&]|\b)jwt=(?!REDACTED(?:[&#"'\s]|$))[^&#"'\s]+/i,
  /([?&]|\b)redir_token=(?!REDACTED(?:[&#"'\s]|$))[^&#"'\s]+/i,
  /([?&]|\b)access_token=(?!REDACTED(?:[&#"'\s]|$))[^&#"'\s]+/i,
  /([?&]|\b)api_key=(?!REDACTED(?:[&#"'\s]|$))[^&#"'\s]+/i,
];

const providerEvidenceTokenPatterns = [
  ...queryTokenPatterns,
  /\bBearer\s+(?!REDACTED\b)[A-Za-z0-9._~+/=-]+/i,
  /\bX-API-KEY["':\s]+(?!REDACTED\b)[A-Za-z0-9._~+/=-]+/i,
  /\bX-Subscription-Token["':\s]+(?!REDACTED\b)[A-Za-z0-9._~+/=-]+/i,
];

const providerEvidenceDir = "plans/evidence/2026-06-23-provider-pass-through";
await requireFile(`${providerEvidenceDir}/summary.md`);
await requireFile(`${providerEvidenceDir}/results.jsonl`);

if (await exists(providerEvidenceDir)) {
  const rows = await readJsonl(`${providerEvidenceDir}/results.jsonl`);
  const expected = REQUIRED_PROVIDER_PATHS.map((row) => `${row.provider}:${row.path}`);
  const seen = new Set();

  for (const row of rows) {
    const key = `${row.provider}:${row.path}`;
    if (seen.has(key)) {
      fail(`${providerEvidenceDir}/results.jsonl has duplicate row for ${key}`);
    }
    seen.add(key);

    if (!ALLOWED_STATUSES.includes(row.status)) {
      fail(`${providerEvidenceDir}/results.jsonl has unsupported status for ${key}: ${row.status}`);
    }
  }

  for (const key of expected) {
    if (!seen.has(key)) {
      fail(`${providerEvidenceDir}/results.jsonl is missing required row ${key}`);
    }
  }

  const summary = await read(`${providerEvidenceDir}/summary.md`);
  for (const status of ALLOWED_STATUSES) {
    if (!summary.includes(status)) {
      fail(`${providerEvidenceDir}/summary.md does not enumerate status ${status}`);
    }
  }

  const evidenceFiles = await walk(providerEvidenceDir);
  for (const file of evidenceFiles) {
    const text = await read(file);
    if (providerEvidenceTokenPatterns.some((pattern) => pattern.test(text))) {
      fail(`${file} appears to contain an unredacted signed URL, bearer token, or API key.`);
    }
  }
}

const evidenceDir = "plans/evidence/2026-06-22-remote-agentic-execution";
if (await exists(evidenceDir)) {
  const evidenceFiles = (await walk(evidenceDir)).filter((file) => file.endsWith(".json"));
  if (evidenceFiles.length === 0) {
    fail(`${evidenceDir} exists but contains no JSON evidence files.`);
  }
  for (const file of evidenceFiles) {
    const text = await read(file);
    if (queryTokenPatterns.some((pattern) => pattern.test(text))) {
      fail(`${file} appears to contain an unredacted signed URL or API token query parameter.`);
    }
  }
} else {
  fail(`Missing evidence directory: ${evidenceDir}`);
}

if (failures.length > 0) {
  console.error("Documentation validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Documentation validation passed.");
}
