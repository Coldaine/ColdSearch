# Project Review and Bright Data Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an evidence-backed ColdSearch project review and Bright Data adoption record while correcting stale documentation without changing product intent.

**Architecture:** Keep volatile facts in one dated review document and make only durable, narrow corrections to evergreen authority documents. Route readers to the review from the README and reconcile the informational implementation plan with merged GitHub work.

**Tech Stack:** Markdown, Git, GitHub CLI, repository documentation validators, Node.js/npm test scripts.

---

### Task 1: Add the dated project review

**Files:**
- Create: `docs/reviews/2026-07-16-project-review-and-bright-data.md`

- [x] **Step 1: Create the review directory**

Run: `New-Item -ItemType Directory -Force docs/reviews`

Expected: `docs/reviews/` exists without modifying other files.

- [x] **Step 2: Write the evidence-backed review**

The document must include:

- the plain-language product charter derived from `docs/NORTH_STAR.md`;
- current implementation status separated into current, planned, candidate, and deferred;
- Bright Data account balance and credit composition as a dated snapshot;
- explicit confirmation that the review consumed no provider quota or account credit;
- official Bright Data documentation links and uncertainty labels for unverified promotion expiry dates;
- capability mapping for search, extract, crawl, structured tools, and browser/proxy tools;
- strict cost, logging, routing, CI, and live-verification gates;
- open issue reconciliation for #40, #31, #14, #8, and #6;
- pull-request reconciliation for #43, #44, #45, and #46;
- memory-versus-live-state reconciliation;
- current validation evidence and an ordered next-action list.

Expected: volatile facts are labeled `Snapshot: 2026-07-16`; candidate capabilities never read as implemented.

- [x] **Step 3: Review the document for authority leakage**

Run: `rg -n "implemented|supported|verified|candidate|snapshot|no.*request|no.*credit" docs/reviews/2026-07-16-project-review-and-bright-data.md`

Expected: Bright Data implementation claims use candidate language; account and GitHub facts are dated.

### Task 2: Correct evergreen architecture and provider documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/PROVIDERS.md`

- [x] **Step 1: Correct provider-tool execution status**

Change the resolved architecture question so it says networked `tool call` execution is current and identifies the next unresolved work as searchable result memory, batch execution, operator UX, and trace correlation.

Expected: the open-question section no longer contradicts the current-status table.

- [x] **Step 2: Add a Bright Data candidate section outside the machine-checked matrix**

Document Bright Data as not implemented, not configured, and not live-verified. Map likely products to ColdSearch category views and list the gates required before it can join default routing.

Expected: the `## Dual Matrix` remains unchanged because no Bright Data adapter or registry entry exists.

- [x] **Step 3: Check the provider matrix boundary**

Run: `npm run test:docs`

Expected: the capability-matrix drift test and documentation validation pass.

### Task 3: Reconcile routing and the active implementation plan

**Files:**
- Modify: `README.md`
- Modify: `plans/2026-06-22-remaining-implementation-master-plan.md`

- [x] **Step 1: Add documentation routing to the README**

Link the North Star, architecture, provider matrix, current dated review, and active implementation plan. State that dated reviews are snapshots and do not override authority documents.

Expected: a new contributor can reach intent, architecture, provider state, review state, and implementation sequence from the README.

- [x] **Step 2: Add a dated plan status refresh**

Record that provider-tool infrastructure and quick-win follow-ups landed in PRs #44 and #45, North Star reconciliation landed in #46, and open PR #43 is superseded. State that active implementation resumes with cache/searchable-memory work rather than replaying PR1.

Expected: historical checklist text remains available, but a reader cannot mistake it for the live starting point.

- [x] **Step 3: Validate documentation references**

Run: `npm run test:docs`

Expected: documentation links, provider matrix, and plan validation pass.

### Task 4: Validate and publish the complete documentation change

**Files:**
- Review: all changed Markdown files

- [x] **Step 1: Run repository validation**

Run:

```powershell
npm run build
npm test
npm run test:docs
git diff --check
```

Expected: every command exits 0.

- [x] **Step 2: Review the complete diff**

Run: `git diff --stat origin/main...HEAD; git diff origin/main...HEAD`

Expected: only approved documentation files changed; no secrets, generated files, or unrelated work are present.

- [x] **Step 3: Commit and push the documentation**

Stage only the documentation files, commit with a documentation-scoped message, and push the current branch with upstream tracking.

Expected: the branch is clean and synchronized with `origin/codex/project-review-bright-data-docs`.

- [x] **Step 4: Open a ready-for-review pull request to `main`**

The PR body must summarize what changed, why volatile and evergreen facts are separated, validation run, and the fact that no Bright Data quota or credit was consumed.

Expected: one non-draft PR targets `main` from `codex/project-review-bright-data-docs`.

- [ ] **Step 5: Complete post-publication review**

Inspect the PR patch, checks, reviews, flat comments, and GraphQL `reviewThreads`. Address valid findings, push follow-up commits, and re-run affected validation until the PR is clean.

Expected: all required checks pass and no valid unresolved review finding remains before reporting completion.
