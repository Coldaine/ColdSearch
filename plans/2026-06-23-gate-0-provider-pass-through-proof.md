# Gate 0: Provider Pass-Through Proof Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:systematic-debugging for investigation discipline and superpowers:executing-plans or superpowers:subagent-driven-development for execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove ColdSearch actually passes through to real provider platform paths and returns useful real provider results before building more provider-tool surface.

**Architecture:** Treat each provider path as a two-leg comparison: provider-native request first, then the equivalent ColdSearch request with a single provider selected. ColdSearch does not need byte-identical output, but it must hit the same real provider path, return non-empty useful results, preserve enough provider detail, and make any transformation explicit.

**Tech Stack:** Node.js, built CLI, provider HTTP APIs or official SDK/CLI where available, existing config/key resolution, evidence JSONL or Markdown under `plans/evidence/`.

---

## Scope

Implement and run a live provider proof gate before PR 1.

This gate covers:

- Current normalized provider paths: `search`, `extract`, and `crawl`.
- Provider-native calls for every implemented provider path.
- ColdSearch calls with exactly one provider selected.
- Result comparison between provider-native output and ColdSearch output.
- Evidence capture for pass/fail/blocked/waived status.

This gate explicitly does not cover:

- Agent mode.
- LLM output quality.
- Remote execution.
- Batch execution.
- Cache hit behavior.
- New provider tools that do not exist yet. Those are covered inside PR 1 using the same parity method.

## Required Provider Paths

Use this table as the minimum set. Do not reduce it to "at least one provider."

| Provider | Path | Provider-native request | ColdSearch request |
| --- | --- | --- | --- |
| Tavily | search | `POST https://api.tavily.com/search` or official SDK | `coldsearch search --providers tavily --single-provider --json <query>` |
| Tavily | extract | `POST https://api.tavily.com/extract` or official SDK | `coldsearch extract --providers tavily --single-provider --json <url>` |
| Tavily | crawl | `POST https://api.tavily.com/crawl` or official SDK | `coldsearch crawl --providers tavily --single-provider --json --limit 3 <url>` |
| Firecrawl | search | `POST https://api.firecrawl.dev/v2/search` or official SDK/CLI | `coldsearch search --providers firecrawl --single-provider --json <query>` |
| Firecrawl | extract | `POST https://api.firecrawl.dev/v2/scrape` or official SDK/CLI | `coldsearch extract --providers firecrawl --single-provider --json <url>` |
| Firecrawl | crawl | `POST https://api.firecrawl.dev/v2/crawl` plus poll, or official SDK/CLI | `coldsearch crawl --providers firecrawl --single-provider --json --limit 3 <url>` |
| Exa | search | `POST https://api.exa.ai/search` or official SDK | `coldsearch search --providers exa --single-provider --json <query>` |
| Exa | extract | `POST https://api.exa.ai/contents` or official SDK | `coldsearch extract --providers exa --single-provider --json <url>` |
| Exa | crawl | Native `search` plus `contents`; record that ColdSearch crawl is synthesized | `coldsearch crawl --providers exa --single-provider --json --limit 3 <url>` |
| Brave | search | `GET https://api.search.brave.com/res/v1/web/search` | `coldsearch search --providers brave --single-provider --json <query>` |
| Serper | search | `POST https://google.serper.dev/search` | `coldsearch search --providers serper --single-provider --json <query>` |
| Jina | extract | `GET https://r.jina.ai/http://<host/path>` | `coldsearch extract --providers jina --single-provider --json <url>` |
| SearXNG | search | `GET <baseUrl>/search?q=<query>&format=json` | `coldsearch search --providers searxng --single-provider --json <query>` |

## Fixed Inputs

Use stable, low-risk inputs so comparisons are understandable:

- Search query: `openai`
- Extract URL: `https://example.com`
- Crawl URL: `https://docs.tavily.com`
- Crawl limit: `3`

If a provider rejects one of these, record the rejection and choose the smallest provider-appropriate replacement. Do not silently change the input.

## Evidence Status Values

Every provider path gets exactly one status:

- `pass` - native and ColdSearch paths both return useful real results and comparison passes.
- `fail` - one path errors, returns empty output unexpectedly, or ColdSearch drops important provider information.
- `blocked_missing_secret` - required key or SearXNG endpoint is unavailable.
- `blocked_provider` - provider platform is down or rejects the request for reasons outside ColdSearch.
- `waived_by_user` - user explicitly accepts not testing this path right now.

Missing credentials are not success. A path with no key remains blocked until the key is provided or the user explicitly waives it.

## Comparison Rules

Do not require byte-for-byte equality. ColdSearch is allowed to normalize, but it must not become a useless wrapper.

For `search`:

- Native response has at least one result.
- ColdSearch response has at least one result.
- At least one URL or title overlaps, or the provider explains why ordering/results differ.
- ColdSearch result includes title, URL, snippet/content, score where applicable, and source/provider.
- Any discarded native fields are listed.

For `extract`:

- Native response has non-empty content or markdown/text.
- ColdSearch response has non-empty content.
- URL/source identity is preserved.
- Title is preserved when native output has one.
- Any native metadata that is important for evaluation is either preserved in raw detail or documented as lost.

For `crawl`:

- Native crawl/discovery returns at least one page when provider succeeds.
- ColdSearch crawl returns at least one page.
- Page URL/content overlap is present where the provider returns comparable pages.
- If ColdSearch synthesizes crawl, as with Exa, the evidence says so explicitly.

For provider tools added in PR 1:

- Native provider tool call and `coldsearch tool call <provider>.<tool>` use the same request payload.
- ColdSearch output includes `provider`, `tool`, `ok`, `raw`, and `meta`.
- `raw` contains the provider-native payload or a documented faithful subset.
- `summary` is optional and never replaces `raw`.

## Evidence Output Shape

Record evidence as JSONL or Markdown. JSONL is preferred for future automation.

Example:

```json
{
  "provider": "firecrawl",
  "path": "search",
  "input": { "query": "openai" },
  "native": {
    "status": "pass",
    "endpoint": "POST https://api.firecrawl.dev/v2/search",
    "result_count": 10,
    "sample_keys": ["title", "url", "description", "markdown", "metadata"]
  },
  "coldsearch": {
    "status": "pass",
    "command": "coldsearch search --providers firecrawl --single-provider --json openai",
    "result_count": 10,
    "sample_keys": ["title", "url", "snippet", "score", "source"]
  },
  "comparison": {
    "status": "pass",
    "overlap": { "url_count": 3, "title_count": 2 },
    "losses": ["native markdown is summarized into snippet in normalized search output"]
  }
}
```

## Tasks

- [ ] Build the project with `npm run build`.
- [ ] Create a temporary config per provider path so each ColdSearch command selects exactly one provider.
- [ ] For each provider path, run the provider-native request first.
- [ ] For each provider path, run the matching ColdSearch request second.
- [ ] Save native response samples with secrets redacted.
- [ ] Save ColdSearch response samples with secrets redacted.
- [ ] Compare native and ColdSearch outputs using the rules above.
- [ ] Produce one evidence row per provider path.
- [ ] Mark every row `pass`, `fail`, `blocked_missing_secret`, `blocked_provider`, or `waived_by_user`.
- [ ] Fix any ColdSearch wrapper that fails due to normalization loss, wrong endpoint, empty output, or broken routing.
- [ ] Re-run failed rows after fixes.
- [ ] Do not begin PR 1 until all rows are `pass` or `waived_by_user`.

## Required Commands

Run:

```bash
npm test
npm run test:docs
npm run build
node scripts/smoke.mjs
```

Then run the provider-native vs ColdSearch comparison harness or manual equivalent. If no harness exists yet, create it as part of this gate before treating the gate as complete.

## Success Criteria

- Every current provider path has explicit evidence.
- ColdSearch is proven to hit real provider APIs, not mocks, for each path with available credentials.
- ColdSearch output is useful and traceable back to provider-native output.
- Important provider-specific information is preserved or explicitly documented as lost.
- No provider path is skipped silently.
- Agentic testing is not used as a substitute for provider pass-through proof.

## PR 1 Carry-Forward Rule

PR 1 must use this same method for each newly exposed provider tool. A provider tool is not done merely because `tool call` returns JSON. It is done only when:

- the provider-native tool path was called,
- the ColdSearch tool path was called with the same input,
- the outputs were compared,
- raw provider detail was preserved, and
- evidence was recorded.
