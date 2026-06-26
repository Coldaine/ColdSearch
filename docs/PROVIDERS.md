# ColdSearch Providers — Capability & Tool Matrix

**Single source of truth** for which providers ColdSearch supports, which of each
vendor's tools are actually wired, and what has been verified against live APIs.
This file replaces the former per-provider pages under `docs/providers/` and the
standalone `docs/CAPABILITY_MATRIX.md`.

**Maintenance rule:** update this file whenever a provider's adapter, registry
entry, or capability coverage changes. The `## Dual Matrix` table below is
machine-checked against the registry (`src/providers.ts`) and the adapters by
`test/capability-matrix-drift.test.mjs` — run `npm run test:docs`.

## Audited common capability views

ColdSearch has two lanes:

- **Common capability views** (`search`, `extract`, `crawl`) for comparable overlapping work.
- **Raw provider tools** (`coldsearch tool <provider>.<tool>`) for provider-specific power where native request shape and raw response detail must survive.

The common views are convenience layers, not permission to erase provider detail.
When a provider-specific field is useful for evaluation, debugging, or advanced
workflows, it must remain reachable through raw payloads, provider-tool calls, or
documented metadata.

| Capability | Meaning |
|------------|---------|
| `search` | general web search routed through a configured provider pool |
| `extract` | retrieve page content from a single URL |
| `crawl` | gather multi-page site content |

## Provider tool shape taxonomy

Provider tools overlap in more ways than the three common views. PR 1 owns the
raw provider-tool surface and must classify each useful tool before wiring it.

| Shape | What it means | Examples | ColdSearch treatment |
|-------|---------------|----------|----------------------|
| `sync-result` | Request returns completed results immediately | Brave web/news/images/videos, Serper web/news/images/videos/shopping, Tavily answer, Exa answer | Expose as raw provider tools with typed input schemas and raw output |
| `vertical-search` | Search-like result list with a provider-specific corpus or vertical | Tavily news topic, Brave news/images/videos, Serper images/news/videos/shopping/maps/places/reviews, SearXNG categories, Exa categories | Keep vertical knobs explicit; add common summaries only where non-lossy |
| `url-discovery` | URL list or site map without full page extraction | Tavily map, Firecrawl map, Exa discovery search for synthesized crawl | Preserve discovered URLs and provider metadata |
| `content-extract` | Single or multi-URL content retrieval | Tavily extract, Firecrawl scrape, Exa contents, Jina Reader | Common `extract` view is useful, but raw metadata/content modes must remain reachable |
| `structured-extract` | Provider uses schema or prompt to return structured fields | Firecrawl structured extract, Exa structured answer where applicable | Raw provider tool; do not collapse schema-specific output into generic text |
| `crawl-job` | Crawl starts or polls an async job | Firecrawl crawl, Tavily crawl where provider behavior is job-like | Model job IDs, polling metadata, status, and final data explicitly |
| `native-batch` | Provider offers its own bulk endpoint | Firecrawl batch scrape | Expose as provider tool; generic `coldsearch batch` remains separate orchestration |
| `answer-research` | Provider synthesizes an answer/report from search | Tavily answer/research, Exa answer/research, Exa web-grounded chat if exposed | Raw provider tool with citations/raw sources preserved |
| `rerank-embedding` | Provider scores, embeds, or reorders supplied content | Jina rerank/embeddings | Explicit provider tool; useful for ColdSearch internals but not a search replacement |
| `interactive/deferred` | Tool can click/type/act on remote sites or run autonomous browser behavior | Firecrawl `/agent`, Firecrawl scrape actions | Deferred unless explicitly prioritized because it can mutate remote state |

## Dual Matrix

Vendor columns = what the provider's API offers at the capability level.
ColdSearch columns = what the adapter actually implements today.
`✅` supported · `⚠️` partial/constrained · `❌` not supported.

| Provider | Vendor `search` | Vendor `extract` | Vendor `crawl` | ColdSearch `search` | ColdSearch `extract` | ColdSearch `crawl` | Notes |
|----------|:---------------:|:----------------:|:--------------:|:-------------------:|:--------------------:|:------------------:|-------|
| Tavily | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Broadest all-rounder |
| Firecrawl | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Vendor surface is richer than the adapter |
| Exa | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | Crawl synthesized via discovery + `contents` |
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
  - **Config-driven options** (set in `config.toml` under `[providers.exa.options]`):
    - `highlights` — token-efficient excerpts (~10x reduction) for agent workflows
    - `category` — specialized indexes (space-separated values): `company`, `people`, `research paper`, `news`, `personal site`, `financial report`. Other strings are accepted as category hints.
    - `searchType` — latency control: `auto`, `keyword`, `neural`, `fast`, `instant`, `deep-lite`, `deep`
    - `maxAgeHours` — cache freshness: `0` = always livecrawl, `-1` = never livecrawl
    - `includeDomains` / `excludeDomains` — domain filters
    - `numResults` — result count (default: 10)
    - `useAutoprompt` — query enhancement (default: true)
    - `maxCharacters` — text length cap (default: 15000)
- `POST /contents` (with livecrawl) → **extract** ✅ and backs synthesized **crawl** ✅
- `POST /findSimilar` (semantic neighbors — unique to Exa) ✅ (available via adapter method, not CLI)
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

These are design choices, not bugs. The current adapters expose common views and
skip many provider specialties. Highest-leverage gaps:

- **Serper** — 10 Google verticals (news, scholar, images, shopping, maps, patents…); only plain web is wired.
- **Jina** — `embeddings` + `rerank` could back ColdSearch's own reranking step; plus a free `search`.
- **Tavily `answer`/`research`** and **Exa `answer`/`research`** — one-call research that overlaps the hand-rolled ReAct agent (`docs/ADRs/003-react-agent.md`).
- **Firecrawl** `map`, schema `extract`, and `batch` — directly useful for the planned batch mode (`plans/2026-06-22-pr3-batch-runner.md`).

## Adding a provider

See `docs/DEVELOPER.md`. In short: implement the `SearchAdapter`, register it in
`src/providers.ts`, add a row to the **Dual Matrix** above, and add tests.
`npm run test:docs` enforces that the Dual Matrix stays in sync with the registry
and the adapter method surfaces.
