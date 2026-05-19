---
title: Routing, LLM policy, and shipping notes
date: 2026-05-19
status: accepted
---

# Routing, LLM policy, and shipping notes

Session summary from agent work on ColdSearch (May 2026). Captures product intent, how the runtime actually behaves, and what landed on branch `feat/ci-governance-and-llm-policy`.

## Product intent (operator)

- **ColdSearch is not a meta-search engine.** It routes three normalized capabilities (`search`, `extract`, `crawl`) through configured provider pools.
- **Secrets** stay out of git: `env:` / `bws:` references in config; Doppler (or similar) can inject env vars at runtime — not wired in-repo.
- **No Anthropic API** at this stage: subscription cannot be used through `api.anthropic.com`, and pay-per-token Anthropic calls are out of scope for now.
- **Agent orchestration LLM** should eventually target an **OpenAI-compatible** HTTP endpoint (not only `api.openai.com`). That base-URL configurability is still a gap in code.
- **Default CLI** (`search` / `extract` / `crawl`) is the core product; **`--agent`** is a separate, experimental multi-step research loop.

## How routing works (code truth)

Config file: `~/.config/coldsearch/config.toml` (copy from `config.example.toml` — nothing is auto-installed).

`resolveCapabilityProviders()` in `src/providers.ts`:

| `strategy` in TOML | CLI `--single-provider` | Providers used |
|--------------------|-------------------------|----------------|
| `"random"` | no | **One** random provider from the pool |
| omitted or `"all"` | no | **Full** pool |
| any | yes | **One** random provider |

**Search** (multiple providers): parallel calls → RRF/score/none rerank → dedupe → limit.

**Extract / crawl** (multiple providers): **sequential** try in list order; first success wins. With `random`, only one provider is tried (no fallback siblings on failure).

`config.example.toml` sets `strategy = "random"` everywhere. Omitting `strategy` in a real config fans out to all providers (note: `coldsearch status` displays `strategy || "all"` for display only — runtime does not default missing strategy to `"all"`).

CLI output labels `mode: "fanout"` whenever `--single-provider` is false, even when config `random` used only one provider — known UX mismatch.

## Agent mode (`--agent`)

`SearchAgent` runs a ReAct-style loop (max steps, default 5):

1. LLM returns JSON: tool call or final answer.
2. Tools: `search` (via `FanoutEngine` + your config), `fetch` (direct HTTP, SSRF-guarded), `refine` (extra LLM call).
3. Output: synthesized `answer` + `sources`.

This is **not** the same as `coldsearch search`. Agent mode requires an orchestration LLM; provider search APIs are still used inside the `search` tool.

## LLM policy (implemented on this branch)

- Removed `ClaudeClient` and all `api.anthropic.com` calls.
- Agent mode: **OpenAI chat completions only** (`OPENAI_API_KEY`); `--llm` accepts `openai` only.
- Documented in `docs/NORTH_STAR.md`, `docs/architecture.md`, `CLAUDE.md`, `SKILL.md`.
- Tests inject a fake `llm` in `SearchAgent` constructor; no `ANTHROPIC_API_KEY` in tests.

**Follow-up:** configurable `OPENAI_BASE_URL` (or `[agent.llm]` in TOML) for OpenAI-compatible proxies (Ollama, OpenRouter, etc.).

## CI / quality gates (what actually runs)

| Job | Command | Proves |
|-----|---------|--------|
| `docs-sync` | `npm run test:docs` | Matrix ↔ registry ↔ provider markdown |
| `build-and-test` | `typecheck` + `npm test` | ~60 unit tests (mocked HTTP) |

Does **not** prove search relevance, live API contracts, or that operator `config.toml` matches `config.example.toml`.

## Commits on this branch (vs `origin/feat/multi-provider-capabilities`)

1. **`feat: implement CI governance and runtime coverage`** — matrix/docs drift tests, GitHub Actions, adapter gaps (Firecrawl search, Exa crawl, Tavily native crawl), fanout/rerank/agent/CLI tests, usage logging, `status`, `--dry-run`, adoption plan stubs.
2. **`fix: remove Anthropic API from agent mode; document routing and LLM policy`** — this session’s code + this decision doc.

## Supersedes

- Prior work lived on `codex/ci-governance-runtime-completion` (PR #4). This branch replaces that head for review against `feat/multi-provider-capabilities`.

## Tracked follow-up (GitHub issues)

Do not lose these — they capture everything called out in the May 2026 session but not implemented in PR #5:

| Issue | Scope |
|-------|--------|
| [#6](https://github.com/Coldaine/ColdSearch/issues/6) | Config bootstrap, `config.example.toml`, OpenAI-compatible base URL, routing UX bugs, agent fetch vs extract |
| [#7](https://github.com/Coldaine/ColdSearch/issues/7) | CI job consolidation, narrower triggers, OpenAI client tests |
| [#8](https://github.com/Coldaine/ColdSearch/issues/8) | **Long-term:** GitHub search playbook, ranked search tools, agent reminders (stars, last commit, etc.) |

## Open questions (short)

1. Default OpenAI-compatible base URL for agent mode (env vs TOML)? → **#6**
2. Should agent `fetch` use the `extract` capability pool instead of raw HTTP? → **#6**
3. Ship operator bootstrap (copy example config, Doppler note) in README? → **#6**
