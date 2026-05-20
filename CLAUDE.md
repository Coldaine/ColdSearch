# CLAUDE.md

Read these docs in this order before touching code:

1. `docs/NORTH_STAR.md` — directional anchor
2. `docs/architecture.md` — technical choices, anti-patterns, tricky parts
3. `docs/PROGRESS.md` — where we are, what's done, what's next
4. `TASK.md` — current build instructions (when present)
5. `SKILL.md` — agent invocation contract
6. `config.example.toml` — example configuration

## Build & Test

```bash
npm install
npm run build
npm run test
npm link              # makes `usearch` available globally for local dev
```

## Conventions

- Config changes never require a code change or rebuild.
- Provider names never appear in the agent-facing interface.
- Every adapter normalizes to the shared result schema before returning.
- **Do not call the Anthropic API** from ColdSearch (`api.anthropic.com`). Agent mode uses OpenAI only when an LLM is required.
- **Backlog:** See GitHub issues [#6](https://github.com/Coldaine/ColdSearch/issues/6) (runtime/config), [#7](https://github.com/Coldaine/ColdSearch/issues/7) (CI/tests), [#8](https://github.com/Coldaine/ColdSearch/issues/8) (long-term GitHub search for agents).
- **Tests:** Read `docs/contributing/testing.md` before adding adapter or drift tests.
