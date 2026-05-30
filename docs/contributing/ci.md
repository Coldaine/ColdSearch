# CI & checks

How ColdSearch is verified — and, more importantly, **how to read a check that went red** before you characterize or override it.

## What runs

**In-repo workflows (`.github/workflows/`):**

| Workflow | Trigger | What it does | Gates merge? |
|---|---|---|---|
| `ci.yml` | every push + PR | `typecheck` → `test:docs` (capability-matrix drift) → `test` (full offline suite) | **yes** |
| `canary.yml` | daily 06:00 UTC + manual dispatch | live smoke test against real provider APIs (`scripts/smoke.mjs`); green even with zero secrets | no |
| `merge-gate.yml` | PR + comment + every 5 min | autonomous merge gate — cooldown since the head commit + an attestation comment ([Merge protocol](#merge-protocol-agents)) | **yes** (rolling out) |

**External apps that post checks to PRs** (configured outside the repo, via GitHub Apps — not in `.github/`):

| Check | Nature | Required? |
|---|---|---|
| SonarCloud Code Analysis | static analysis / quality gate | no |
| CodeRabbit | AI review | no |
| Kilo Code Review | AI review | no |
| GitGuardian Security Checks | secret scanning | no |

`ci` is a **required** status, and `merge-gate` is being added as required (see [Merge protocol](#merge-protocol-agents)). The rest are advisory — but advisory is not the same as ignorable (see the rule below).

## Reading a red check

> A red check is a **question, not a fact**. You don't get to say *why* it failed until you've read the reason. "Probably X" about a check you haven't opened is a fabrication — the tell is the word "probably."

The conclusion (`failure`) and the reason live at different depths. The conclusion is in the status rollup; the reason is in the check-run **summary**, behind its **details_url**, or in the tool's own API. Getting it is one extra call, not a dashboard login:

```bash
SHA=$(gh pr view <PR#> --json headRefOid --jq .headRefOid)

# Check-runs — the .output.summary usually already states the reason:
gh api repos/Coldaine/ColdSearch/commits/$SHA/check-runs \
  --jq '.check_runs[] | "\(.name): \(.conclusion)\n\(.output.summary // "")\n"'

# Commit statuses — some tools (e.g. CodeRabbit) post here instead of check-runs:
gh api repos/Coldaine/ColdSearch/commits/$SHA/status \
  --jq '.statuses[] | "\(.context): \(.state)  \(.target_url)"'
```

## SonarCloud specifically

This project's SonarCloud project is configured **public**, so its findings are readable **anonymously** via the Web API — the `curl` commands below were run with no token and returned data. (SonarCloud visibility is set in SonarCloud and is independent of GitHub repo visibility; it just happens to be public here — don't assume a public GitHub repo implies a public Sonar project.) So there's no "I couldn't see it without the dashboard."

- Project key: `Coldaine_ColdSearch`
- Analysis mode: **Automatic Analysis** — the SonarCloud GitHub App scans on push; there is deliberately no scanner step in `ci.yml`.

```bash
# Which gate conditions failed, with actual-vs-threshold values:
curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=Coldaine_ColdSearch&pullRequest=<PR#>"

# The specific issues behind a rating (e.g. what exactly makes reliability a "D"):
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=Coldaine_ColdSearch&pullRequest=<PR#>&resolved=false"
```

Swap `&pullRequest=<PR#>` for `&branch=main` to inspect a branch instead of a PR. (A *private* project would need `-u <SONAR_TOKEN>:`; this one does not.)

### Tuning what SonarCloud flags

Because analysis is automatic, **`sonar-project.properties` is ignored** — SonarCloud reads **`.sonarcloud.properties`** at the repo root instead. It honors `sonar.sources/exclusions/inclusions`, `sonar.tests/test.exclusions`, `sonar.sourceEncoding`, and `sonar.cpd.exclusions` — but **not** `sonar.issue.ignore.multicriteria`. Note: pattern syntax in this file is more restricted than CI-based analysis (wildcard support is limited), so verify any exclusion pattern against the docs below before relying on it.

- **Duplication / coverage noise from tests** → exclude it via `sonar.cpd.exclusions` (confirm the exact pattern syntax against the docs below — the Automatic-Analysis form is restricted), or set the exclusion in the SonarCloud UI, which uses standard path patterns.
- **A rule firing as a false positive** → in priority order: (1) fix the code to satisfy the rule, (2) add `// NOSONAR` on the offending line, or (3) mark the issue *Accept / False Positive* in the dashboard (the only option that needs a SonarCloud login). Prefer (1) or (3) over blanket rule-disabling.

Docs: <https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis/>

## Merge protocol (agents)

`main` is protected: every change lands via a PR — no direct pushes, **no admin/agent bypass** (`enforce_admins` on). Beyond `ci`, a **`merge-gate`** check enforces an autonomous, human-free merge discipline, so an agent can't open a PR and merge it seconds later before the reviewers have spoken:

1. **Cooldown** — a PR cannot merge until ~15 min after its **head commit** (resets on every push, so the gate always covers the final code). The window lets async reviewers — CodeRabbit, SonarCloud, GitGuardian — actually post.
2. **Attestation** — after reading the checks and review comments, post a PR **comment** (not the PR body) containing exactly:

   > I have read all checks and review comments on this PR and affirm I have addressed all valid findings.

`merge-gate` is **self-describing**: if it's red, read its summary (`gh pr checks` or the check's details) — it states the remaining cooldown and the exact phrase to post. That is the discovery path — a compliant agent reads the failing check and learns what to do, no prior knowledge required.

CodeRabbit and the other review bots are **advisory**: read their comments and address the valid ones, but the merge does **not** require them to be green (free-tier / occasionally flaky). The un-gameable parts are `ci` + the cooldown; the attestation is a forcing-function and an on-record acknowledgement, not a guarantee that the agent actually read anything.
