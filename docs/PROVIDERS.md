# ColdSearch Providers — Capability & Tool Matrix

**Single source of truth** for which providers ColdSearch supports, which of each
vendor's tools are actually wired, and what has been verified against live APIs.
This file replaces the former per-provider pages under `docs/providers/` and the
standalone `docs/CAPABILITY_MATRIX.md`.

**Maintenance rule:** update this file whenever a provider's adapter, registry
entry, or capability coverage changes. The `## Dual Matrix` table below is
machine-checked against the registry (`src/providers.ts`) and the adapters by
`test/capability-matrix-drift.test.mjs` — run `npm run test:docs`.

## Normalized capabilities

ColdSearch normalizes every provider to three capabilities. Provider names never
appear in the agent-facing interface — callers ask for a capability, not a vendor.

| Capability | Meaning |
|------------|---------|
| `search` | general web search routed through a configured provider pool |
| `extract` | retrieve page content from a single URL |
| `crawl` | gather multi-page site content |

## Dual Matrix

Vendor columns = what the provider's API offers at the capability level.
ColdSearch columns = what the adapter actually implements today.
`✅` supported · `⚠️` partial/constrained · `❌` not supported.

| Provider | Vendor `search` | Vendor `extract` | Vendor `crawl` | ColdSearch `search` | ColdSearch `extract` | ColdSearch `crawl` | Notes |
|----------|:---------------:|:----------------:|:--------------:|:-------------------:|:--------------------:|:------------------:|-------|
| Tavily | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Broadest all-rounder |
| Firecrawl | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Vendor surface is richer than the adapter |
| Exa | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | Highlights, categories, findSimilar; crawl via discovery + `contents` |
| Brave | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Search-only vendor |
| Serper | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Google SERP; search-only vendor |
| Jina | ⚠️ | ✅ | ⚠️ | ❌ | ✅ | ❌ | Reader extraction only today |
| SearXNG | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | Self-hosted; operator-configured `baseUrl` |

## Live verification status

Last verified **2026-05-28** against real provider APIs via `scripts/smoke.mjs`
and ad-hoc probes. `✅⚡` = live-verified end-to-end · `✅` = implemented but not
yet live-checked · `—` = not applicable.

| Provider | search | extract | crawl |
|----------|:------:|:-------:|:-----:|
| Tavily | ✅⚡ | ✅⚡ | ✅⚡ |
| Firecrawl | ✅⚡ | ✅⚡ | ✅⚡ |
| Exa | ✅⚡ | ✅⚡ | ✅⚡ |
| Brave | ✅⚡ | — | — |
| Jina | — | ✅⚡ | — |
| Serper | ✅ (no key in test env) | — | — |
| SearXNG | ✅ (needs an endpoint) | — | — |

Only Serper and SearXNG search remain un-live-verified, and only because no key /
endpoint was available in the verification environment — not because of code.

## Vendor tool surface

What each vendor's API offers, and what ColdSearch wires. `✅` wired ·
`❌` available upstream but not wired. Vendor pricing and rate limits live in each
vendor's own docs (linked) — they go stale fast and are intentionally not mirrored here.

### Tavily — `src/adapters/tavily.ts` · [docs](https://docs.tavily.com)
- `POST /search` → **search** ✅ (a `topic:"news"` variant exists but is not separately exposed)
- `POST /extract` → **extract** ✅
- `POST /crawl` → **crawl** ✅
- `POST /map` (URL discovery) ❌
- `POST /answer` (one-shot answer + citations) ❌
- `POST /research` (multi-search report) ❌

### Firecrawl — `src/adapters/firecrawl.ts` · [docs](https://docs.firecrawl.dev)
- `POST /search` → **search** ✅
- `POST /scrape` → **extract** ✅
- `POST /crawl` (async job, polled) → **crawl** ✅
- `POST /map` (URL discovery) ❌
- `POST /extract` (schema / LLM structured extraction) ❌
- `/scrape` actions (interact: click/scroll/type) ❌
- `POST /agent` (autonomous browser agent) ❌
- `POST /batch/scrape` (bulk) ❌

### Exa — `src/adapters/exa.ts` · [docs](https://docs.exa.ai)
- `POST /search` → **search** ✅
  - Search types: `auto`, `keyword`, `neural`, `fast`, `instant`, `deep-lite`, `deep` ✅
  - Category filters: `company`, `people`, `research paper`, `github`, `tweet`, `news`, `personal site`, `financial report` ✅
  - Content modes: `highlights` (token-efficient), `text` (full content) ✅
  - Freshness: `maxAgeHours` for cache/livecrawl control ✅
  - Domain filters: `includeDomains`, `excludeDomains` ✅
- `POST /contents` (with livecrawl) → **extract** ✅ and backs synthesized **crawl** ✅
- `POST /findSimilar` (semantic neighbors — unique to Exa) ✅
- `POST /answer` ❌
- `POST /research` (async) ❌
- `POST /chat/completions` (web-grounded chat) ❌

### Brave — `src/adapters/brave.ts` · [docs](https://api.search.brave.com/app/documentation/)
- `GET /res/v1/web/search` → **search** ✅
- `/res/v1/news/search`, `/res/v1/images/search`, `/res/v1/videos/search` ❌
- `/suggest` (autocomplete), `/spellcheck` ❌
- Data-for-AI LLM context (paid) ❌

### Serper — `src/adapters/serper.ts` · [docs](https://serper.dev/docs)
- `POST /search` (Google web) → **search** ✅
- `/images`, `/news`, `/videos`, `/shopping`, `/maps`, `/places`, `/scholar`, `/patents`, `/autocomplete`, `/reviews` ❌ — **10 Google verticals unused**

### Jina — `src/adapters/jina.ts` · [docs](https://jina.ai)
- `r.jina.ai` Reader → **extract** ✅ (keyless)
- `s.jina.ai` search ❌
- deep-search, `/v1/embeddings`, `/v1/rerank`, summarize ❌

### SearXNG — `src/adapters/searxng.ts` · [docs](https://docs.searxng.org)
- `/search` (general) → **search** ✅ (operator-configured `baseUrl`, optional `SEARXNG_BASE_URL`)
- category variants (news / images / …) ❌

## Unexposed surface worth considering

These are design choices, not bugs — the adapters expose the common denominator and
skip vendor specialties. Highest-leverage gaps:

- **Serper** — 10 Google verticals (news, scholar, images, shopping, maps, patents…); only plain web is wired.
- **Jina** — `embeddings` + `rerank` could back ColdSearch's own reranking step; plus a free `search`.
- **Tavily `answer`/`research`** and **Exa `answer`/`research`** — one-call research that overlaps the hand-rolled ReAct agent (`docs/ADRs/003-react-agent.md`).
- **Firecrawl** `map`, schema `extract`, and `batch` — directly useful for the planned batch mode (`docs/PROGRESS.md`).

## Adding a provider

See `docs/DEVELOPER.md`. In short: implement the `SearchAdapter`, register it in
`src/providers.ts`, add a row to the **Dual Matrix** above, and add tests.
`npm run test:docs` enforces that the Dual Matrix stays in sync with the registry
and the adapter method surfaces.
