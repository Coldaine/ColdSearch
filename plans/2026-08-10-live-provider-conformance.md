# Live Provider Conformance Plan

**Goal:** Turn the existing Gate 0/native-parity harness and scheduled smoke checks into visible provider/path integration coverage without making paid live calls part of ordinary PR validation.

**Relationship to Gate 0:** [Gate 0](./2026-06-23-gate-0-provider-pass-through-proof.md) remains the detailed one-time full-matrix baseline, including native endpoints, fixed inputs, comparison rules, evidence shape, and provider-tool carry-forward requirements. This plan governs ongoing scoped and scheduled operation after that baseline.

## Scope

Conformance asks: **Does ColdSearch still correctly reach and wrap this provider?**

Evaluation asks: **Was this provider useful for this search?**

Conformance verifies transport, authentication, request construction, response handling, normalization, raw-detail preservation, and safe provenance. It does not score relevance, rank providers, or manufacture searches for provider comparison.

Run a scoped native-vs-ColdSearch conformance check when changing:

- a provider adapter or endpoint
- provider HTTP request construction, retries, or timeouts
- authentication or key handling
- provider response normalization or raw-result preservation
- generic provider-tool dispatch
- provider-facing routing behavior

Do not run the full live-provider matrix after unrelated changes, including history/cache, formatting, documentation, batch, agent, or internal refactoring changes. Continue broader live checks on a schedule. Use a full matrix only for the initial Gate 0 baseline, a shared provider-facing change that genuinely affects every path, or an explicit user request.

## Coverage Report

Every supported provider/path must be visible in the scheduled/manual report as exactly one of:

- `pass`
- `fail`
- `blocked_missing_secret`
- `blocked_provider`
- `not_run`
- `waived_by_user` only when a user explicitly waives an otherwise required scoped check

A workflow may complete successfully while some rows are blocked or not run, but its summary must show those rows and totals. “Workflow succeeded” must never imply “all supported provider integrations passed.” Reuse the Gate 0 status semantics and provider/path inventory rather than creating a second harness or status model.

The shared inventory must also cover provider-tool dispatch: add provider-tool rows (for example `tavily.map` or `brave.newsSearch`) with native runners for catalogued provider tools, using the same status vocabulary. Otherwise a scoped check triggered by a generic provider-tool change has no row to run, and the outstanding provider-tool parity evidence from PR 1 cannot be produced.

## Evidence Isolation

The committed Gate 0 directory under `plans/evidence/2026-06-23-provider-pass-through/` is the historical full-matrix baseline. Ongoing scoped checks must **not** write there because the harness clears its selected output directory before writing new evidence.

For manual scoped checks, always provide a separate temporary/output directory. Scheduled coverage should likewise write ephemeral workflow artifacts or another non-baseline location.

## Tasks

- [ ] Extend/reuse `scripts/provider-pass-through.mjs` scoped provider/path selection while preserving `--all` for the deliberate Gate 0 baseline.
- [ ] Extend the shared provider/path inventory with provider-tool rows (provider.tool IDs and native runners) so scoped checks cover catalogued provider tools.
- [ ] Make the harness emit one machine-readable row per provider/path in scope.
- [ ] Make omitted supported paths explicit as `not_run` in coverage summaries.
- [ ] Reuse `pass`, `fail`, `blocked_missing_secret`, `blocked_provider`, and `waived_by_user` semantics from Gate 0.
- [ ] Update `scripts/smoke.mjs` or a thin reporter around it to emit the same provider/path coverage vocabulary; do not invent a separate live harness.
- [ ] Publish totals and the provider/path table in the scheduled workflow summary.
- [ ] Keep scheduled/manual live workflows non-gating and absent from push/PR triggers.
- [ ] Document the scoped manual command in contributor testing guidance.
- [ ] Ensure missing credentials remain visible rather than being treated as tested passes.
- [ ] Ensure scoped/manual runs use an output directory separate from the committed Gate 0 baseline.
- [ ] Publish scoped/manual coverage summaries where reviewers can inspect them (PR comment/summary or workflow artifact) without writing to the committed baseline.

## Required Tests

- [ ] Offline harness tests prove provider/path filters select only requested rows.
- [ ] Offline reporter tests prove every supported row is `pass`, `fail`, blocked, waived, or `not_run`.
- [ ] Offline tests prove a successful workflow summary can still disclose blocked/not-run rows without calling them passes.
- [ ] Offline tests prove secrets and signed URLs are redacted from evidence and summaries.
- [ ] Workflow/config tests prove live coverage is scheduled/manual only and does not gate PRs.
- [ ] Offline tests or command-contract checks prove scoped runs do not overwrite the committed Gate 0 evidence directory.

## Validation

For a provider-facing change, run only the affected rows after offline tests and write them outside the committed baseline:

```bash
npm test
node scripts/provider-pass-through.mjs \
  --provider <provider> \
  --path <path> \
  --out-dir /tmp/coldsearch-conformance-<provider>-<path>
```

Publish the scoped coverage summary with the provider-facing change — for example, paste the machine-readable summary table into the PR or attach it as an artifact — so reviewers can inspect the pass/fail/blocked/waived rows. Temporary output alone is not evidence; keep the raw files outside the committed Gate 0 baseline directory.

For scheduled coverage, inspect the workflow summary produced by the canary. Run `node scripts/provider-pass-through.mjs --all` against the committed Gate 0 evidence directory only under the full-matrix conditions listed in Scope.

What these prove:

- `npm test` proves harness selection, coverage reporting, redaction, evidence isolation, and offline behavior without spending provider credits.
- The scoped native-vs-ColdSearch command proves the changed integration path against the real provider when credentials are available without replacing the historical full-matrix baseline.
- The scheduled summary makes tested, blocked, waived, and untested coverage visible over time.

Expected:

- Ordinary PR validation remains offline.
- Only affected provider/path rows are called manually for a provider-facing change.
- Scoped checks never overwrite the committed Gate 0 baseline evidence.
- Scoped run results are published where reviewers can inspect them instead of existing only in a temporary directory.
- The scheduled report enumerates coverage instead of presenting a misleading binary green/red result.
- No conformance output claims which provider was most useful.

## Success Criteria

- Existing Gate 0 comparison logic is reused rather than replaced.
- Live coverage is visible by provider and path.
- Missing credentials/endpoints and intentionally unrun paths are explicit.
- Paid calls are not a merge gate, default completion step, or routine validation ritual.
- Scoped/manual evidence cannot overwrite the committed Gate 0 full-matrix baseline.
- Provider-effectiveness evidence continues to come from accumulated real executions unless a task explicitly requests comparative evaluation.
