# CLAUDE.md

Project router: see `AGENTS.md` first — it indexes architecture, ADRs, operations, providers, and contributing docs.

Read in this order before touching code:

1. `AGENTS.md` — project map (start here)
2. `docs/NORTH_STAR.md` — directional anchor
3. `docs/architecture.md` — technical choices, anti-patterns, tricky parts
4. `docs/PROGRESS.md` — where we are, what's done, what's next
5. `SKILL.md` — agent invocation contract (CLI commands and flags)
6. `docs/ADRs/` — design decisions (fanout, RRF, ReAct; the SSRF ADR is planned — see [#11](https://github.com/Coldaine/ColdSearch/issues/11))
7. `config.example.toml` — example configuration

## Build & Test

```bash
npm install
npm run build
npm run test
npm link              # makes `coldsearch` (and `usearch` alias) available globally for local dev
```

## Conventions

- Config changes never require a code change or rebuild.
- Provider names never appear in the agent-facing interface.
- Every adapter normalizes to the shared result schema before returning.
- **Do not call the Anthropic API** from ColdSearch (`api.anthropic.com`). Agent mode uses OpenAI-compatible providers only when an LLM is required (openai, groq, openrouter, cerebras, xai — see `src/agent/llm.ts`).
- Agent mode supports a custom OpenAI-compatible base URL via `--llm-base-url` (CLI, applies to any `--llm` provider). The `OPENAI_BASE_URL` env var is also honored, but only for the default `openai` provider.
- **Tests:** Read `docs/contributing/testing.md` before adding adapter or drift tests.

## Backlog

- **Implementation:** [#6](https://github.com/Coldaine/ColdSearch/issues/6) (config bootstrap UX), [#7](https://github.com/Coldaine/ColdSearch/issues/7) (CI/tests), [#14](https://github.com/Coldaine/ColdSearch/issues/14) (run IDs).
- **Strategic gaps (not yet filed):** read-through result cache for `search`/`extract`; batch mode (`coldsearch batch`) reading JSONL queries with dedup and resumability. See `docs/PROGRESS.md` for sequencing.
- **Long-term:** [#8](https://github.com/Coldaine/ColdSearch/issues/8) (GitHub-as-search-corpus).
- **Docs:** [#10](https://github.com/Coldaine/ColdSearch/issues/10) (DEVELOPER.md), [#11](https://github.com/Coldaine/ColdSearch/issues/11) (ADR 004 SSRF).
