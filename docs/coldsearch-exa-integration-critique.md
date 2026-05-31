# ColdSearch Exa Integration — Critique & Recommendations

**Date:** 2026-05-31
**Analyst:** Zo (GLM 5)
**Context:** Evaluation of ColdSearch's current Exa adapter against Exa's full API surface and best practices

---

## Executive Summary

ColdSearch's current Exa adapter (`src/adapters/exa.ts`) implements the **core three capabilities** (search, extract, crawl) but **does not leverage Exa's unique differentiators** and misses several best practices that would improve result quality, token efficiency, and latency.

**Key gaps:**
1. **Not using highlights** — 10x token efficiency gain available
2. **No category filters** — missing specialized indexes (company, people, research paper)
3. **Missing search type control** — no `fast`/`instant`/`deep` variants
4. **findSimilar not wired** — unique semantic similarity feature unavailable
5. **answer endpoint not exposed** — one-shot grounded answers with citations
6. **Crawl synthesized inefficiently** — could use `livecrawl` directly on search

**Verdict:** The adapter is **structurally sound** but **feature-incomplete**. The integration is safe and functional, but ColdSearch is paying for Exa's premium neural index without using its most powerful features.

---

## Current Implementation Analysis

### What's Working

The adapter correctly:

1. **Normalizes results** to the shared `NormalizedResult` schema
2. **Fetches content** via `/contents` endpoint
3. **Synthesizes crawl** via search → contents pipeline
4. **Uses autoprompt** — enabling Exa's query enhancement

### Code Review: `src/adapters/exa.ts`

```typescript
// Current search implementation (lines 24-45)
const data = await fetchJson<{...}>("https://api.exa.ai/search", {
  method: "POST",
  headers: {...},
  body: JSON.stringify({
    query,
    numResults: 10,
    useAutoprompt: true,
    contents: { text: true },  // ← Full text always requested
  }),
});
```

**Issue:** Always requests full `text`. For agentic workflows making repeated calls, this floods context windows.

---

## Gap 1: Token Efficiency — Highlights vs. Full Text

**Exa best practice (from docs):**
> "Use highlights for agentic workflows: When building multi-step agents that make repeated search calls, highlights provide the most relevant excerpts without flooding context windows."

**Current behavior:** Always requests `contents: { text: true }` — full page content.

**Recommendation:**
- Add `--highlights` flag to CLI for agent-mode calls
- Modify `search()` to accept a `contents` options object:

```typescript
interface ExaCallOptions extends AdapterCallOptions {
  highlights?: boolean;
  text?: boolean | { maxCharacters: number };
  maxAgeHours?: number;
}

// Default to highlights for efficiency, text for deep research
const contents = options?.highlights
  ? { highlights: true }
  : { text: { maxCharacters: 15000 } };
```

**Impact:** ~10x token reduction for multi-turn agent workflows.

---

## Gap 2: Category Filters — Specialized Indexes

Exa provides **specialized neural indexes** for:
- `company` — Company pages, LinkedIn company profiles
- `people` — Multi-source person data, LinkedIn profiles
- `research paper` — arXiv, peer-reviewed papers
- `news` — Current events, journalism
- `github` — Code repositories
- `tweet` — Twitter/X content
- `pdf` — PDF documents
- `personal site` — Blogs, personal pages (Exa's unique strength)

**Current behavior:** No category filter exposed.

**Recommendation:**
Add `--category` CLI flag and route to adapter:

```typescript
// In search body
...(options?.category && { category: options.category }),
```

**Use cases:**
- `coldsearch search "quantum computing papers" --category research-paper`
- `coldsearch search "AI startups series A" --category company`
- `coldsearch search "elon musk latest" --category tweet`

---

## Gap 3: Search Type — Latency vs. Depth

Exa offers search types with tradeoffs:

| Type | Latency | Use Case |
|------|---------|----------|
| `instant` | Sub-200ms | Autocomplete, live suggestions |
| `fast` | Low | Speed-critical, moderate quality |
| `auto` | Default | Balanced speed/quality |
| `deep-lite` | ~4s | Synthesized output, multi-step |
| `deep` | 4-15s | Complex queries, structured output |
| `deep-reasoning` | 12-40s | Hard research tasks |

**Current behavior:** Always uses default (`auto`).

**Recommendation:**
Add `--search-type` flag:

```typescript
// Accept type parameter
const searchType = options?.searchType || "auto";

body: JSON.stringify({
  query,
  type: searchType,
  ...
}),
```

**Use cases:**
- Agent tool calls: `type: "instant"` for real-time suggestions
- Research mode: `type: "deep"` with `outputSchema` for structured extraction

---

## Gap 4: findSimilar — Unique Semantic Feature

**Exa's findSimilar** returns pages semantically similar to a given URL. This is **unique to Exa** and **not available in other providers**.

**Current status:** Marked as `❌` in `docs/PROVIDERS.md` — not wired.

**Endpoint:** `POST /findSimilar`

```typescript
// Recommended implementation
async findSimilar(
  url: string,
  apiKey: string,
  options?: FindSimilarCallOptions
): Promise<NormalizedResult[]> {
  const data = await fetchJson<{...}>("https://api.exa.ai/findSimilar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      url,
      numResults: options?.limit || 10,
      excludeSourceDomain: options?.excludeSourceDomain ?? true,
      contents: {
        highlights: true,  // Default to highlights for efficiency
      },
    }),
  });

  return (data.results || []).map((result, index) => ({
    title: result.title || "",
    url: result.url || "",
    snippet: result.text || result.highlights?.join(" ") || "",
    score: result.score ?? (1 - index * 0.1),
    source: this.name,
  }));
}
```

**New capability consideration:** Should ColdSearch normalize `findSimilar` as a separate capability or route through `search`?

**Proposal:** Add as `findSimilar` capability, available only when `--provider exa`.

---

## Gap 5: Answer Endpoint — Grounded Q&A

**Exa's `/answer` endpoint** returns a direct answer with citations:

```json
{
  "answer": "The current Fed interest rate is 5.25-5.50%.",
  "citations": [
    {"url": "https://federalreserve.gov/...", "title": "Federal Reserve"}
  ]
}
```

**Current status:** Not implemented.

**Recommendation:**
Wire as a new capability `answer` or expose via CLI:

```bash
coldsearch answer "What is the current Fed interest rate?" --provider exa
```

This overlaps with the **ReAct agent** (`docs/ADRs/003-react-agent.md`). Consider:
- **Option A:** Expose `answer` as a shortcut for one-shot questions (non-agent mode)
- **Option B:** Use internally in the ReAct agent as a faster path for factual queries

---

## Gap 6: crawl() Implementation — Inefficient Discovery

**Current implementation (lines 73-122):**
1. Search for `site:domain` to discover pages
2. Fetch contents for discovered URLs

**Issue:** Two API calls, no livecrawl freshness control.

**Better approach:**
Use Exa's `livecrawl` option directly on search:

```typescript
async crawl(url: string, apiKey: string, options?: CrawlCallOptions): Promise<CrawlResult[]> {
  const domain = new URL(url).hostname;

  const data = await fetchJson<{...}>("https://api.exa.ai/search", {
    method: "POST",
    headers: {...},
    body: JSON.stringify({
      query: `site:${domain}`,
      numResults: options?.limit || 10,
      contents: {
        text: { maxCharacters: 12000 },
      },
      livecrawl: "always",  // Fresh content
      livecrawlTimeout: 10000,
    }),
  });

  return (data.results || []).map((result) => ({
    url: result.url || "",
    title: result.title || "",
    content: result.text || "",
  }));
}
```

**Benefit:** Single API call, freshness controlled.

---

## Gap 7: Content Freshness — maxAgeHours

Exa provides fine-grained **cache vs. livecrawl control**:

```json
{
  "maxAgeHours": 24,  // Use cache if < 24h old, else livecrawl
  "maxAgeHours": 0,   // Always livecrawl
  "maxAgeHours": -1,  // Never livecrawl (cache only)
}
```

**Current behavior:** No freshness control.

**Recommendation:**
Add `--freshness` flag (hours) for time-sensitive queries:

```bash
coldsearch search "latest AI news" --freshness 4
```

Maps to `maxAgeHours: 4` in request.

---

## Gap 8: Output Schema — Structured Extraction

Exa's deep search types support **structured output via JSON Schema**:

```json
{
  "type": "deep",
  "outputSchema": {
    "type": "object",
    "properties": {
      "companies": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "ceo": {"type": "string"},
            "valuation": {"type": "number"}
          }
        }
      }
    }
  }
}
```

**Current behavior:** No structured output support.

**Recommendation:**
For agent mode or batch mode, support `--output-schema` accepting a JSON path:

```bash
coldsearch search "AI startups" \
  --search-type deep \
  --output-schema ./schemas/startup.json
```

---

## Gap 9: Domain Filters

Exa supports `includeDomains` and `excludeDomains`:

```json
{
  "includeDomains": ["openai.com", "anthropic.com"],
  "excludeDomains": ["twitter.com"]
}
```

**Current behavior:** Not exposed.

**Recommendation:**
Add CLI flags:

```bash
coldsearch search "GPT-5 announcements" \
  --include-domains openai.com,anthropic.com \
  --exclude-domains twitter.com
```

---

## Proposed Implementation Priority

### Phase 1 — High Impact, Low Effort (1-2 days)
1. **Highlights support** — Add `--highlights` flag, 10x token efficiency
2. **Category filters** — Wire `--category` to API parameter
3. **Search type** — Add `--search-type` flag (instant/fast/auto/deep)

### Phase 2 — New Capabilities (2-3 days)
4. **findSimilar** — New capability, unique to Exa
5. **Answer endpoint** — One-shot Q&A with citations
6. **Domain filters** — `--include-domains`, `--exclude-domains`

### Phase 3 — Advanced Features (3-5 days)
7. **Content freshness** — `--freshness` → `maxAgeHours`
8. **Output schema** — Structured extraction for deep search
9. **crawl() optimization** — Single-call with livecrawl

---

## Integration Anti-Patterns to Avoid

From Exa's "Best Practices & Pitfalls" documentation:

1. **Don't treat Exa as keyword search**: Exa is neural search. Long, descriptive queries work better than keyword stuffing.
2. **Don't skip autoprompt**: `useAutoprompt: true` helps reformulate queries for the neural index.
3. **Don't request full text unnecessarily**: Use `highlights` for factual lookups, `text` only when deep analysis needed.
4. **Don't mix categories incorrectly**: `people` and `company` have restrictions on date/domain filters.

---

## Comparison: ColdSearch vs. Direct Exa SDK

If ColdSearch didn't exist and you were choosing:

| Factor | ColdSearch | Direct Exa SDK |
|--------|------------|----------------|
| Multi-provider | ✅ 7 providers | ❌ Single vendor |
| Unified schema | ✅ Normalized | ❌ Vendor-specific |
| Exa-specific features | ⚠️ Partial | ✅ Full surface |
| Caching | ✅ Built-in | ❌ DIY |
| CLI UX | ✅ Rich CLI | ❌ API only |

**Recommendation:** Stay with ColdSearch, but **prioritize wiring Exa's unique features**. The adapter foundation is solid — it just needs the specialist tools Exa provides.

---

## Critique Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Core capabilities | ✅ Good | search/extract/crawl functional |
| Best practices | ⚠️ Partial | Missing highlights, category, freshness |
| Exa differentiators | ❌ Missing | findSimilar, answer, structured output |
| Code quality | ✅ Good | Clean, normalized, error handling |
| Documentation | ✅ Good | PROVIDERS.md accurately reflects gaps |

---

## Next Steps

1. **Decide on scope:** All 9 gaps, or prioritize P1 first?
2. **Capability expansion:** Should `findSimilar` and `answer` be new capabilities or new flags?
3. **Agent integration:** Should the ReAct agent use Exa's `/answer` for factual queries?

---

## Sources

[^1]: https://exa.ai/docs/reference/search-best-practices
[^2]: https://exa.ai/docs/reference/search-api-guide
[^3]: https://exa.ai/docs/sdks/typescript-sdk-specification
[^4]: https://github.com/exa-labs/exa-js
[^5]: https://github.com/exa-labs/exa-py
[^6]: https://exa.ai/docs/reference/agent-api-guide
[^7]: https://exa.ai/docs/sdks/cheat-sheet
[^8]: `/home/workspace/GitHub/coldaine-github-repos/ColdSearch/src/adapters/exa.ts`
[^9]: `/home/workspace/GitHub/coldaine-github-repos/ColdSearch/docs/PROVIDERS.md`
