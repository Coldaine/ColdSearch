# Tavily Provider

**Website:** https://tavily.com  
**API Docs:** https://docs.tavily.com  
**Pricing:** https://tavily.com/#pricing

## Overview

Tavily is a search engine optimized for AI agents and LLMs, providing real-time, accurate results with source attribution. It combines search and content extraction in a single API call.

## Authentication

```bash
export TAVILY_API_KEY="tvly-..."
```

## Configuration Example

```toml
[providers.tavily]
[providers.tavily.keyPool]
keys = ["env:TAVILY_API_KEY"]
```

## Capabilities

| Capability | Vendor | ColdSearch | Notes |
|------------|--------|------------|-------|
| `search` | ✅ | ✅ | Implemented by `search()` in `src/adapters/tavily.ts` |
| `extract` | ✅ | ✅ | Implemented by `extract()` in `src/adapters/tavily.ts` |
| `crawl` | ✅ | ✅ | Implemented by native `POST /crawl` in `crawl()` |

## Available Tools

ColdSearch wires Tavily `search`, `extract`, and `crawl` through `src/adapters/tavily.ts`. Tavily `map`, `answer`, and `research` remain upstream API capabilities that are documented here but not exposed directly by the current ColdSearch adapter.

### 1. `tavily_web_search`

Search the web with AI-optimized snippets.

**Endpoint:** `POST /search`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `search_depth` | string | No | `"basic"` or `"advanced"` |
| `topic` | string | No | `"general"`, `"news"`, `"finance"` |
| `time_range` | string | No | `"day"`, `"week"`, `"month"`, `"year"` |
| `max_results` | number | No | Default: 5, Max: 20 |
| `include_domains` | string[] | No | Whitelist domains |
| `exclude_domains` | string[] | No | Blacklist domains |
| `include_answer` | boolean | No | Include AI-generated answer |
| `include_raw_content` | boolean | No | Include full page content |

**Example:**

```json
{
  "query": "latest AI breakthroughs",
  "search_depth": "advanced",
  "topic": "news",
  "max_results": 10
}
```

---

### 2. `tavily_news_search`

Search news articles specifically.

**Endpoint:** `POST /search` (with `topic: "news"`)

**Parameters:** Same as `tavily_web_search` plus `topic: "news"`

**Use when:** Looking for recent news, current events, breaking stories.

---

### 3. `tavily_extract`

Extract full content from URLs.

**Endpoint:** `POST /extract`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | string[] | Yes | Up to 20 URLs to extract |
| `include_images` | boolean | No | Include image URLs |
| `extract_depth` | string | No | `"basic"` or `"advanced"` |

**Example:**

```json
{
  "urls": ["https://example.com/article1", "https://example.com/article2"],
  "extract_depth": "advanced"
}
```

---

### 4. `tavily_map`

Discover all URLs on a website.

**Endpoint:** `POST /map`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Base URL to map |
| `search_depth` | string | No | `"basic"` or `"advanced"` |
| `max_results` | number | No | Max URLs to return |

**Example:**

```json
{
  "url": "https://docs.example.com",
  "max_results": 100
}
```

---

### 5. `tavily_crawl`

Map + extract combined for entire sites.

**Endpoint:** `POST /crawl`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Starting URL |
| `max_results` | number | No | Max pages to crawl |
| `extract_depth` | string | No | `"basic"` or `"advanced"` |

**Example:**

```json
{
  "url": "https://blog.example.com",
  "max_results": 50,
  "extract_depth": "advanced"
}
```

---

### 6. `tavily_answer`

Get direct answers with citations.

**Endpoint:** `POST /answer`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Question to answer |
| `search_depth` | string | No | `"basic"` or `"advanced"` |
| `include_sources` | boolean | No | Include source URLs |

**Example:**

```json
{
  "query": "What is the capital of France?",
  "search_depth": "advanced",
  "include_sources": true
}
```

**Returns:** Direct answer plus source citations.

---

### 7. `tavily_research`

Automated multi-search research report.

**Endpoint:** `POST /research`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Research topic |
| `max_results` | number | No | Sources to synthesize |
| `time_range` | string | No | `"day"`, `"week"`, `"month"`, `"year"` |

**Example:**

```json
{
  "query": "Impact of AI on healthcare 2024",
  "max_results": 20
}
```

**Returns:** Synthesized report with multiple sources.

---

## Provider Capability Matrix

| Tool | Endpoint | Upstream API | Adapter implemented | Notes |
|------|----------|--------------|---------------------|-------|
| `tavily_web_search` | /search | ✅ | ✅ | Backed by `search()` in `src/adapters/tavily.ts` |
| `tavily_news_search` | /search | ✅ | ⚠️ | Same upstream endpoint; topic-specific surface is not separately exposed by ColdSearch |
| `tavily_extract` | /extract | ✅ | ✅ | Backed by `extract()` in `src/adapters/tavily.ts` |
| `tavily_map` | /map | ✅ | ❌ | Upstream-only today |
| `tavily_crawl` | /crawl | ✅ | ✅ | Backed by `crawl()` in `src/adapters/tavily.ts` |
| `tavily_answer` | /answer | ✅ | ❌ | Upstream-only today |
| `tavily_research` | /research | ✅ | ❌ | Upstream-only today |

## Rate Limits

- **Free:** 100 requests/minute
- **Developer:** 1,000 requests/minute
- **Enterprise:** Custom limits

## Pricing

- **Free:** 1,000 credits/month
- **Pay-as-you-go:** $0.008/credit
- **Developer:** $30/month (3,000 credits)
- **Enterprise:** Custom

## Notes

- All endpoints consume credits (1 credit = 1 request for most endpoints)
- Advanced search depth uses 2 credits
- Credits reset monthly on free tier
- SOC-2 certified
