# Plan — Next PR: Read-Through Result Cache (Gap A, Phase A1)

> Scope note: this plan is deliberately narrowed to **one shippable PR**. It is
> the highest-ROI item from the 2026-05-27 roadmap/CI review. Batch mode and the rest
> of the backlog are explicitly out of scope and listed at the end.

## Context

ColdSearch is single-tenant. Every `search`/`extract` call today pays full
provider cost even when the identical query ran minutes ago, and sibling agent
runs re-ask the same questions. A read-through cache removes that waste with no
privacy tradeoff (one tenant). This is the single change that most improves
day-to-day economics and latency.

Scope is **Phase A1 only**: read-through caching for `search` and `extract`,
on by default, with an opt-out. Cache management subcommands and freshness
tuning are Phase A2 (a later PR).

## Open decision (resolve before coding)

**Storage backend.** Two viable options, no new-runtime-dependency required for
either:

| Option | Pros | Cons |
|--------|------|------|
| **File-based JSON** (recommended for A1) | Zero dependencies; trivial; easy to inspect/delete; no native build step | Manual TTL sweep; not transactional (fine for single tenant) |
| `node:sqlite` (built-in, Node ≥ 22.5) | Real queries, indexes, single file | Emits an experimental warning per process unless suppressed; ties min Node to 22 |
| `better-sqlite3` (npm) | Mature, sync API | Native module / install step (install was declined this session) |

Recommendation: **file-based JSON cache** for A1 — `~/.config/coldsearch/cache/<capability>/<hash>.json`,
one file per entry, each storing `{ key, query|url, options, payload, created_at, ttl_seconds }`.
Revisit SQLite in A2 only if entry counts make a flat directory unwieldy.

## Implementation path

- **New `src/cache/cache.ts`** — `CacheStore` with `get(key)` / `set(key, value, ttl)`;
  expiry checked on read (lazy eviction); best-effort writes that never break a
  request (mirror the `UsageLogger` try/catch pattern in `src/logging/usage.ts`).
- **New `src/cache/key.ts`** — `cacheKey(capability, queryOrUrl, normalizedOptions)`
  → `sha256` hex. **Provider-agnostic**: deliberately excludes the provider so a
  hit serves regardless of which provider would have run.
- **Config schema** (`src/types.ts` + `config.example.toml`):
  ```toml
  [cache]
  enabled = true          # default true; --no-cache overrides
  search_ttl = "6h"
  extract_ttl = "24h"
  # path = "~/.config/coldsearch/cache"   # optional
  ```
  Add a small duration parser (`"6h"` → seconds). Keep it local to the cache module.
- **Integration point:** `src/execution/backend.ts` (`LocalExecutionBackend`),
  *above* `FanoutEngine`. Check cache before `engine.search/extract`; write after a
  successful result. `FanoutEngine` stays untouched — the cache wraps it, matching
  the existing "execution backend seam" in `docs/architecture.md`.
- **CLI:** add `--no-cache` to `search` and `extract` parsing in `src/cli.ts`
  (alongside the existing `--single-provider` / `--dry-run` flags). Thread it into
  `FanoutOptions` as `noCache`. No new subcommands in A1.

Crawl is excluded from A1 (different fallback shape; lower hit rate).

## Tests (extend the existing offline suite)

- `test/cache.test.mjs` — unit: `set` then `get` returns the value; expired entry
  returns miss; corrupt/missing file returns miss without throwing.
- Extend `test/fanout-engine.test.mjs` (or a new backend test): two identical
  `search` calls with cache on ⇒ the fetch mock is hit **once**; with `--no-cache`
  ⇒ hit **twice**. This is the behavioral contract from the session verification plan.

## Verification (end-to-end)

```bash
npm run build
# warm + hit (expect identical JSON, second call served from cache):
coldsearch search --config <cfg> --json "node lts version"
coldsearch search --config <cfg> --json "node lts version"
# bypass (expect a fresh provider call):
coldsearch search --config <cfg> --no-cache --json "node lts version"
```
Confirm cache hits via `usage.jsonl` line-count delta (a hit writes no usage entry).

## Why this scope, and not more

- **Batch mode** is the natural follow-on but depends on the cache existing
  (intra-batch dedup short-circuits through it). Ship cache first.
- **Cross-process coordination** is intentionally skipped (single tenant).
- **Config bootstrap UX (#6)** will fold in the new `[cache]` keys naturally once
  they exist — cleaner to do after, not before.

## Status (updated at end of this session)

- [x] Docs refresh (CLAUDE.md, SKILL.md, PROGRESS.md) — landed in PR #20.
- [x] Session record + this plan — landed in PR #20.
- [x] Canary smoke workflow + `scripts/smoke.mjs` — landed in PR #20 (live-provider
      drift detection; the gap the cache work will eventually lean on for safety).
- [x] **Cache layer (Phase A1, this plan)** — landed in PR #26. Storage decision resolved: **file-based JSON** (`~/.config/coldsearch/cache/<capability>/<sha256>.json`). On by default, provider-agnostic key, `--no-cache` opt-out.
- [ ] Cache Phase A2 — `cache stats`/`cache clear`, `--freshness`, atomic-write + restrictive-perms hardening.
- [ ] Batch mode — next; now unblocked by the cache.
- [x] Branch cleanup done; issues #10/#11/#12/#13 closed; #7 closed. Remaining: #6, #14.
