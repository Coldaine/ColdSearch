---
title: Routing, LLM policy, and shipping notes
date: 2026-05-19
status: accepted
doc_type: decision-record
---

# Routing, LLM policy, and shipping notes

**Canonical archive** of the May 2026 agent session on ColdSearch. Use this when onboarding, reviewing PR #5, or picking up backlog work. GitHub issues [#6](https://github.com/Coldaine/ColdSearch/issues/6), [#7](https://github.com/Coldaine/ColdSearch/issues/7), [#8](https://github.com/Coldaine/ColdSearch/issues/8) track what is not done yet.

**Shipped on branch:** `feat/ci-governance-and-llm-policy` → [PR #5](https://github.com/Coldaine/ColdSearch/pull/5) (base: `feat/multi-provider-capabilities`). Supersedes [PR #4](https://github.com/Coldaine/ColdSearch/pull/4) on `codex/ci-governance-runtime-completion`.

---

## Why this document exists

The operator pushed back on several conflations during the session:

1. **Governance tests** (docs/matrix/registry sync) were discussed as if they improved search quality — they only prevent **lying documentation**.
2. **Adapter gap fixes** (Firecrawl search, Exa crawl, Tavily `/crawl`) were discussed as if they made providers “work together” — they only enable a provider **when selected** from the pool.
3. **`config.example.toml`** was treated like runtime behavior — only `~/.config/coldsearch/config.toml` (manually created) matters.
4. **Agent mode** was blurred with default `search` / fanout — they are different code paths.
5. **Anthropic API** appeared in code/docs while the operator policy is **no Anthropic API calls** (subscription not usable that way; revisit only if that changes).

This file preserves **code truth**, **product intent**, **what landed**, **what did not**, and **where to work next**.

---

## Product intent (operator)

| Topic | Decision |
|-------|----------|
| Core product | CLI over three capabilities: `search`, `extract`, `crawl` — normalized schemas, config-driven provider pools |
| Not a meta-search engine | Providers do not fuse into one index unless you set `strategy = "all"` on **search** and multiple providers return results |
| Human control | Routing, pools, key rotation in `config.toml` — not model-picked provider hopping mid-request |
| Secrets | Never in git. Config holds `env:` or `bws:` references only. **Doppler is not in-repo** — run `doppler run -- coldsearch …` (or similar) to populate env vars. **BWS is in-repo** (`src/resolvers/bws.ts`, `BWS_ACCESS_TOKEN`) |
| Anthropic API | **Out of scope now** — no `api.anthropic.com` from ColdSearch. Not about hating Anthropic; subscription/API path is not what we want today |
| Agent orchestration LLM | Should become **OpenAI-compatible HTTP** (configurable base URL). **Today:** hardcoded `https://api.openai.com/v1/chat/completions` + `OPENAI_API_KEY` |
| Agent mode | **Experimental** layer on top — not the main search path |
| GitHub discovery by agents | **Long-term** — playbook + ranked tools + reminders ([#8](https://github.com/Coldaine/ColdSearch/issues/8)); current generic search is inadequate (stars, last commit, etc.) |

---

## Configuration (how it actually works)

| Artifact | Role |
|----------|------|
| `config.example.toml` | Template in repo — **not loaded** at runtime |
| `~/.config/coldsearch/config.toml` | **Required** — `loadConfig()` throws if missing |
| `~/.config/usearch/config.toml` | Legacy fallback path if new path absent |
| `--config PATH` | Override file location |

**Private repo does not change this:** nothing auto-installs a working config or secrets on clone.

### Key resolution (`src/engine/keypool.ts`)

- `env:VAR_NAME` → `process.env`
- `bws:NAME_OR_ID` → Bitwarden Secrets Manager
- Raw string in `keys` → literal (tests only)

**Agent LLM keys are separate:** `ANTHROPIC_API_KEY` removed from flow; agent uses `OPENAI_API_KEY` via `createLLMClient()` — not from `config.toml` key pools.

### Example config vs runtime defaults

`config.example.toml` sets `strategy = "random"` on search, extract, and crawl.

| Config | Effect |
|--------|--------|
| `strategy = "random"` | One random provider per request |
| `strategy` omitted | **Full pool** (fanout for search; sequential for extract/crawl) |
| `--single-provider` | Forces one random provider even if strategy is `all` |

**Mismatch:** CLI help implies default is fanout; example config is random everywhere. **`coldsearch status`** shows `strategy \|\| "all"` for display only — runtime does **not** apply that default.

---

## How routing works (code truth)

Entry: `resolveCapabilityProviders()` in `src/providers.ts` → `FanoutEngine` in `src/engine/fanout.ts`.

### Search

- **One provider:** single parallel call (trivial), still runs **rerank** (mostly no-op).
- **Multiple providers:** `Promise.allSettled` in parallel → `rerank()` (default RRF, `--rerank` override) → dedupe by URL → `--limit`.
- Partial failure OK if at least one provider succeeds; errors collected per provider.

### Extract and crawl

- **Asymmetric vs search:** sequential `for` loop in config list order; **first success returns**.
- **`random` strategy:** only **one** provider tried — failure does **not** fall through to siblings.

### Agent `search` tool

Calls `backend.search()` with `limit: 5`, `rerankStrategy: "rrf"`, **no** `singleProvider` override — follows your `[capabilities.search]` config (random vs all).

### Agent `fetch` tool

Direct HTTP with SSRF guards in `SearchAgent` — **not** the extract provider pool (open question → #6).

---

## Default CLI vs agent mode

| | `coldsearch search` (default) | `coldsearch --agent` |
|--|-------------------------------|----------------------|
| Orchestration LLM | None | OpenAI chat completions |
| Search | FanoutEngine + config | Same, via `search` tool inside loop |
| Output | Normalized results JSON | Synthesized `answer` + `sources` |
| Steps | Single request | ReAct loop (default 5 steps) |
| Tools | N/A | `search`, `fetch`, `refine` (JSON payloads) |

CLI labels `mode: "single-provider"` only when `--single-provider` flag set — **not** when config uses `random` (bug → #6).

---

## What PR #5 shipped (meaningful scope)

### CI / governance (`.github/workflows/ci.yml`)

| Job | Command | Value |
|-----|---------|--------|
| `docs-sync` | `npm run test:docs` | Matrix ↔ `providerRegistry` ↔ provider markdown sections/tables |
| `build-and-test` | `typecheck` + `npm test` | Full unit suite (~60 tests), mocked HTTP |

**Not CI-gated:** live APIs, ranking quality, `config.example.toml` vs registry, adoption plan files, Troubleshooting sections in every provider doc.

**CI critique (session):** Jobs are **useful** but **duplicate** `npm ci` + build; workflow triggers on all branch pushes. Consolidation → #7. **SonarCloud** failed on PR — org tool, not this workflow.

### Adapter/runtime (not “providers working together”)

| Change | Meaning |
|--------|---------|
| Firecrawl `search()` | Provider can serve search when selected — `POST api.firecrawl.dev/v2/search` |
| Exa `crawl()` | Composite: `site:` search + `/contents` with `livecrawl: preferred` — not native Exa crawl API |
| Tavily `crawl()` | Native `POST api.tavily.com/crawl` (replaced search+extract heuristic) |

### Other runtime

- `UsageLogger` → `~/.config/coldsearch/usage.jsonl`
- `coldsearch status`, `--dry-run`
- `docs/CONFIGURATION.md`, adoption plan stubs under `docs/plans/`
- Tests: adapters (7), fanout, reranker, agent (mock LLM), CLI integration (limited), matrix/registry/docs drift

### LLM policy (second commit)

- **Removed:** `ClaudeClient`, `api.anthropic.com`, `--llm anthropic`, `ANTHROPIC_API_KEY` in tests
- **Replaced with:** `OpenAIClient` only — **not** open-source/local LLM, **not** configurable base URL yet
- **Tests:** Agent tests inject fake `llm`; one test asserts `createLLMClient("anthropic")` throws; **no** mocked HTTP test for `OpenAIClient` → #7

---

## What we explicitly did NOT ship

- Auto-install config or secrets on clone
- Doppler integration (documented pattern only)
- `OPENAI_BASE_URL` / `[agent.llm]` in TOML
- Fix CLI `mode` / `status` strategy display bugs
- Align `config.example.toml` with intended defaults (fanout vs random, Exa in crawl pool)
- GitHub search playbook or tools ([#8](https://github.com/Coldaine/ColdSearch/issues/8))
- Merge to `feat/multi-provider-capabilities` (PR open for review)

---

## Tests (session conclusion)

- **Local / CI:** `npm test` → 60 tests, 0 fail (after Anthropic removal)
- **Useful for:** adapter normalization, fanout random vs all, extract/crawl failover, reranker, SSRF, doc/registry drift, CLI shape with fake SearXNG
- **Weak for:** live provider contracts, search quality, `OpenAIClient` HTTP shape, full CLI agent path with real env

---

## Git workflow (session)

1. Work started on `codex/ci-governance-runtime-completion` → PR #4
2. Consolidated to `feat/ci-governance-and-llm-policy` → PR #5
3. Commits: governance/runtime (`1b9a49f`), Anthropic removal + decision doc (`4fab306`), issue links in docs (`aecab28`)
4. PR #4 commented as superseded; close after #5 merges

---

## Long-term: GitHub search for agents ([#8](https://github.com/Coldaine/ColdSearch/issues/8))

Operator requirement (separate from ColdSearch runtime):

1. **Playbook** — how agents should query GitHub (`gh`, API, scopes)
2. **Better tools** — structured results, not worst-in-class fuzzy search
3. **Reminders** — rule/skill so agents use playbook + tools before naive web search

**Minimum metadata per repo hit:** star count, last commit (default branch), branch name, archived/fork, language, license, description, why it matched. Issue/PR hits: state, updated_at, labels, etc.

---

## Tracked follow-up (GitHub issues)

| Issue | Scope |
|-------|--------|
| [#6](https://github.com/Coldaine/ColdSearch/issues/6) | Config bootstrap, example config, OpenAI-compatible base URL, routing UX, agent fetch vs extract, README |
| [#7](https://github.com/Coldaine/ColdSearch/issues/7) | CI merge jobs, trigger narrowing, OpenAI client tests |
| [#8](https://github.com/Coldaine/ColdSearch/issues/8) | Long-term GitHub search playbook, tools, reminders |

Also linked from `CLAUDE.md` and PR #5 comments.

---

## Key source files (for implementers)

| Area | Files |
|------|--------|
| Routing | `src/providers.ts`, `src/engine/fanout.ts`, `src/engine/reranker.ts` |
| Config | `src/config.ts`, `config.example.toml` |
| Agent | `src/agent/agent.ts`, `src/agent/tools.ts`, `src/agent/llm.ts` |
| CLI | `src/cli.ts` |
| Keys | `src/engine/keypool.ts`, `src/resolvers/bws.ts` |
| CI | `.github/workflows/ci.yml`, `test/capability-matrix-drift.test.mjs`, `test/providers-docs.test.mjs` |
| Direction | `docs/NORTH_STAR.md`, `docs/architecture.md` |

---

## Open questions → issues

1. OpenAI-compatible base URL — env vs TOML? → **#6**
2. Agent `fetch` vs extract pool? → **#6**
3. Operator bootstrap + Doppler docs? → **#6**
4. CI efficiency + LLM tests? → **#7**
5. GitHub agent search? → **#8**
