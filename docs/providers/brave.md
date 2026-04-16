# Brave Search Provider

**Website:** https://brave.com/search/api/  
**API Docs:** https://api.search.brave.com/app/documentation/

## Overview

Brave Search API provides web, news, image, and video search with an independent index of 30B+ pages. Privacy-focused with AI Grounding for RAG applications.

## Authentication

```bash
export BRAVE_API_KEY="BSA..."
```

## Configuration Example

```toml
[providers.brave]
[providers.brave.keyPool]
keys = ["env:BRAVE_API_KEY"]
```

## Capabilities

| Capability | Vendor | ColdSearch | Notes |
|------------|--------|------------|-------|
| `search` | ✅ | ✅ | Implemented by `search()` in `src/adapters/brave.ts` |
| `extract` | ❌ | ❌ | Not implemented |
| `crawl` | ❌ | ❌ | Not implemented |

## Available Tools

### 1. `brave_web_search`

Standard web search.

**Endpoint:** `GET /res/v1/web/search`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `count` | number | No | Results per page (max: 20) |
| `offset` | number | No | Pagination offset |
| `mkt` | string | No | Market (e.g., `en-US`) |
| `safesearch` | string | No | `"off"`, `"moderate"`, `"strict"` |
| `freshness` | string | No | `"pd"`, `"pw"`, `"pm"`, `"py"` or date range |
| `text_decorations` | boolean | No | Include bold markers |
| `spellcheck` | boolean | No | Auto-correct query |
| `result_filter` | string | No | Filter by result type |
| `goggles_id` | string | No | Custom ranking Goggle |

**Freshness Options:**
- `pd` - Past day
- `pw` - Past week
- `pm` - Past month
- `py` - Past year

**Example:**
```json
{
  "q": "machine learning tutorials",
  "count": 10,
  "freshness": "pw",
  "mkt": "en-US"
}
```

---

### 2. `brave_news_search`

Search news articles.

**Endpoint:** `GET /res/v1/news/search`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `count` | number | No | Results to return |
| `offset` | number | No | Pagination |
| `mkt` | string | No | Market |
| `freshness` | string | No | Time filter |
| `safesearch` | string | No | Safety level |

**Example:**
```json
{
  "q": "AI breakthrough",
  "count": 20,
  "freshness": "pd"
}
```

---

### 3. `brave_image_search`

Search images.

**Endpoint:** `GET /res/v1/images/search`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `count` | number | No | Results count |
| `offset` | number | No | Pagination |
| `mkt` | string | No | Market |
| `safesearch` | string | No | Safety level |

**Example:**
```json
{
  "q": "cute cats",
  "count": 10
}
```

---

### 4. `brave_video_search`

Search videos.

**Endpoint:** `GET /res/v1/videos/search`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `count` | number | No | Results count |
| `offset` | number | No | Pagination |
| `mkt` | string | No | Market |
| `safesearch` | string | No | Safety level |

---

### 5. `brave_autocomplete`

Get search suggestions.

**Endpoint:** `GET /api/suggest`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Partial query |
| `count` | number | No | Suggestions count |

**Example:**
```json
{
  "q": "machine lea",
  "count": 5
}
```

**Returns:** Array of suggestions

---

### 6. `brave_spellcheck`

Check and correct spelling.

**Endpoint:** `GET /api/spellcheck`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Query to check |

**Example:**
```json
{
  "q": "machine learnng"
}
```

**Returns:** Corrected query suggestions

---

### 7. `brave_llm_context` (Data for AI)

Get LLM-optimized context for RAG.

**Endpoint:** Available in Data for AI plan

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Query |
| `context_size` | string | No | `"small"`, `"medium"`, `"large"` |

**Returns:** Context-optimized results for LLM grounding

---

## Provider Capability Matrix

| Tool | Endpoint | Free Tier | Notes |
|------|----------|-----------|-------|
| `brave_web_search` | /res/v1/web/search | ✅ 2,000/mo | Web results |
| `brave_news_search` | /res/v1/news/search | ✅ 2,000/mo | News articles |
| `brave_image_search` | /res/v1/images/search | ✅ 2,000/mo | Image search |
| `brave_video_search` | /res/v1/videos/search | ✅ 2,000/mo | Video search |
| `brave_autocomplete` | /api/suggest | ✅ 2,000/mo | Search suggestions |
| `brave_spellcheck` | /api/spellcheck | ✅ 2,000/mo | Spell checking |
| `brave_llm_context` | Data for AI | ❌ Paid only | LLM-optimized results |

## Rate Limits

- **Free:** 1 query/second
- **Developer:** 10 queries/second
- **Enterprise:** Custom limits

## Pricing

- **Free:** 2,000 queries/month
- **Search:** $5 per 1,000 requests
- **Answers:** $4 per 1,000 + $5 per million tokens
- **Data for AI:** Separate pricing

## Goggles (Custom Ranking)

Brave supports "Goggles" - custom ranking rules:
```json
{
  "q": "tech news",
  "goggles_id": "tech_blogs_only"
}
```

Create custom Goggles at https://search.brave.com/goggles

## Notes

- Independent index (not Bing/Google proxy)
- Privacy-focused, no user tracking
- AI Grounding for RAG
- Used by Claude MCP
- 30B+ pages indexed
