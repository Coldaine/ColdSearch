# AGENTS.md

Read `docs/NORTH_STAR.md` first. Do not infer intent from code.

Authority on conflict: `docs/NORTH_STAR.md` > `docs/architecture.md` > `AGENTS.md`.

Route by task:
- Intent, scope, boundaries → `docs/NORTH_STAR.md`
- Technical shape, invariants → `docs/architecture.md`
- Provider matrix → `docs/PROVIDERS.md`
- Durable decisions → `docs/ADRs/`
- Add or change a provider → `docs/contributing/adding-a-provider.md`
- Config, keys, CI → `docs/CONFIGURATION.md`, `docs/KEY_MANAGEMENT.md`, `docs/contributing/ci.md`
- Active implementation plans → `plans/` (do not create PROGRESS.md; informational; issues and code win)

Crosses a goal, anti-goal, pillar, or invariant → stop and surface the conflict.

Commands: `npm install && npm run build` · `npm test` · PRs to `main` only (`docs/contributing/ci.md` merge protocol)
