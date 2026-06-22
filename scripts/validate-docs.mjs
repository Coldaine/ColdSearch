import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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
  return readFile(path.join(root, relativePath), "utf8");
}

function fail(message) {
  failures.push(message);
}

async function requireFile(relativePath) {
  if (!(await exists(relativePath))) {
    fail(`Missing required file: ${relativePath}`);
  }
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
  "docs/architecture.md",
  "docs/PROVIDERS.md",
]) {
  await requireFile(file);
}

const master = await read("plans/2026-06-22-remaining-implementation-master-plan.md");
for (const file of planFiles) {
  const basename = path.basename(file);
  if (!master.includes(basename)) {
    fail(`Master plan does not link ${basename}`);
  }
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
  if (!text.includes("npm test") || !text.includes("npm run test:docs")) {
    fail(`${file} does not require both npm test and npm run test:docs.`);
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

for (const file of docsAndPlans) {
  const text = await read(file);
  if (text.includes("docs/PROGRESS.md") || text.includes("PROGRESS.md")) {
    fail(`${file} still references deleted PROGRESS.md.`);
  }
  if (/PR1[–-]PR4/.test(text) || /PR1\\u2013PR4/.test(text)) {
    fail(`${file} still references PR1-PR4 as the active sequence.`);
  }
}

const architecture = await read("docs/architecture.md");
if (!architecture.includes("| Remote / hybrid worker implementation | Deferred |")) {
  fail("architecture.md must mark remote/hybrid worker implementation as Deferred.");
}

const rootEntries = await readdir(root);
const rootResearchJson = rootEntries.filter((name) =>
  name.endsWith(".json") &&
  name !== "package.json" &&
  name !== "package-lock.json" &&
  name !== "tsconfig.json"
);
if (rootResearchJson.length > 0) {
  fail(`Research JSON artifacts should not live at repo root: ${rootResearchJson.join(", ")}`);
}

const evidenceDir = "plans/evidence/2026-06-22-remote-agentic-execution";
if (await exists(evidenceDir)) {
  const evidenceFiles = (await walk(evidenceDir)).filter((file) => file.endsWith(".json"));
  if (evidenceFiles.length === 0) {
    fail(`${evidenceDir} exists but contains no JSON evidence files.`);
  }
  for (const file of evidenceFiles) {
    const text = await read(file);
    const tokenPatterns = [
      /([?&]|\b)jwt=(?!REDACTED(?:[&#"'\s]|$))[^&#"'\s]+/i,
      /([?&]|\b)redir_token=(?!REDACTED(?:[&#"'\s]|$))[^&#"'\s]+/i,
      /([?&]|\b)access_token=(?!REDACTED(?:[&#"'\s]|$))[^&#"'\s]+/i,
      /([?&]|\b)api_key=(?!REDACTED(?:[&#"'\s]|$))[^&#"'\s]+/i,
    ];
    if (tokenPatterns.some((pattern) => pattern.test(text))) {
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
