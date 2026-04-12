# Serper Provider

**Website:** https://serper.dev  
**API Docs:** https://serper.dev/docs  
**Pricing:** https://serper.dev

## Overview

Serper.dev provides fast Google Search API access with structured SERP data. Supports all major Google verticals including web, images, news, videos, shopping, maps, scholar, and patents.

## Authentication

```bash
export SERPER_API_KEY="..."
```

## Available Tools

### 1. `serper_web_search`

Google web search.

**Endpoint:** `POST /search`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `gl` | string | No | Country code (e.g., `us`, `uk`) |
| `hl` | string | No | Language code (e.g., `en`) |
| `num` | number | No | Results count (max: 100) |
| `page` | number | No | Page number |
| `tbs` | string | No | Time filter |
| `location` | string | No | Location for local results |

**Time Filters (`tbs`):**

- `qdr:h` - Past hour
- `qdr:d` - Past 24 hours
- `qdr:w` - Past week
- `qdr:m` - Past month
- `qdr:y` - Past year

**Example:**

```json
{
  "q": "machine learning",
  "gl": "us",
  "hl": "en",
  "num": 10,
  "tbs": "qdr:w"
}
```

---

### 2. `serper_image_search`

Google Images search.

**Endpoint:** `POST /images`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `gl` | string | No | Country code |
| `hl` | string | No | Language code |
| `num` | number | No | Results count |
| `page` | number | No | Page number |
| `safe` | string | No | `"active"` or `"off"` |

**Example:**

```json
{
  "q": "mountain landscape",
  "num": 20
}
```

---

### 3. `serper_news_search`

Google News search.

**Endpoint:** `POST /news`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `gl` | string | No | Country code |
| `hl` | string | No | Language code |
| `num` | number | No | Results count |
| `page` | number | No | Page number |
| `tbs` | string | No | Time filter |

**Example:**

```json
{
  "q": "technology",
  "tbs": "qdr:d",
  "num": 10
}
```

---

### 4. `serper_video_search`

Google Videos search.

**Endpoint:** `POST /videos`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `gl` | string | No | Country code |
| `hl` | string | No | Language code |
| `num` | number | No | Results count |
| `page` | number | No | Page number |

---

### 5. `serper_shopping_search`

Google Shopping search.

**Endpoint:** `POST /shopping`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `gl` | string | No | Country code |
| `hl` | string | No | Language code |
| `num` | number | No | Results count |
| `page` | number | No | Page number |

---

### 6. `serper_maps_search`

Google Maps search.

**Endpoint:** `POST /maps`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `gl` | string | No | Country code |
| `hl` | string | No | Language code |
| `ll` | string | No | Lat,lng (e.g., `@40.7128,-74.0060,14z`) |
| `num` | number | No | Results count |

**Example:**

```json
{
  "q": "coffee shops",
  "ll": "@40.7128,-74.0060,14z",
  "num": 10
}
```

---

### 7. `serper_places_search`

Google Places search (alias for maps).

**Endpoint:** `POST /places` or `POST /maps`

**Parameters:** Same as `serper_maps_search`

---

### 8. `serper_scholar_search`

Google Scholar (academic papers).

**Endpoint:** `POST /scholar`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `gl` | string | No | Country code |
| `hl` | string | No | Language code |
| `num` | number | No | Results count |
| `page` | number | No | Page number |
| `as_ylo` | number | No | Published after year |
| `as_yhi` | number | No | Published before year |

**Example:**

```json
{
  "q": "transformer architecture",
  "as_ylo": 2020,
  "num": 10
}
```

---

### 9. `serper_patents_search`

Google Patents search.

**Endpoint:** `POST /patents`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `gl` | string | No | Country code |
| `hl` | string | No | Language code |
| `num` | number | No | Results count |
| `page` | number | No | Page number |

---

### 10. `serper_autocomplete`

Google Autocomplete suggestions.

**Endpoint:** `POST /autocomplete`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Partial query |
| `gl` | string | No | Country code |
| `hl` | string | No | Language code |

**Example:**

```json
{
  "q": "best rest",
  "gl": "us"
}
```

---

### 11. `serper_get_reviews`

Get reviews for a place.

**Endpoint:** `POST /reviews`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `place_id` | string | Yes | Google Place ID |
| `num` | number | No | Number of reviews |

---

## Provider Capability Matrix

| Tool | Endpoint | Shared account quota (2,500 total) | Notes |
|------|----------|------------------------------------|-------|
| `serper_web_search` | /search | shared | Web results |
| `serper_image_search` | /images | shared | Image search |
| `serper_news_search` | /news | shared | News articles |
| `serper_video_search` | /videos | shared | Video search |
| `serper_shopping_search` | /shopping | shared | Product listings |
| `serper_maps_search` | /maps | shared | Local businesses |
| `serper_places_search` | /places | shared | Alias for maps |
| `serper_scholar_search` | /scholar | shared | Academic papers |
| `serper_patents_search` | /patents | shared | Patent filings |
| `serper_autocomplete` | /autocomplete | shared | Suggestions |
| `serper_get_reviews` | /reviews | shared | Place reviews |

All endpoints share a single account-level pool of 2,500 free credits.

## Rate Limits

As of 2026-04-12. Source: https://serper.dev

- **Free:** 2,500 one-time queries; the official pricing page does not publish a dedicated free-tier QPS limit.
- **Starter:** 50 queries/second
- **Standard:** 100 queries/second
- **Scale:** 200 queries/second
- **Ultimate:** 300 queries/second

## Pricing

As of 2026-04-12. Source: https://serper.dev

- **Free:** 2,500 one-time queries (no credit card)
- **Starter:** $50 for 50,000 credits ($1.00 / 1k)
- **Standard:** $375 for 500,000 credits ($0.75 / 1k)
- **Scale:** $1,250 for 2.5M credits ($0.50 / 1k)
- **Ultimate:** $3,750 for 12.5M credits ($0.30 / 1k)
- Credits are sold as top-up packs and are valid for 6 months.

## Response Structure

All endpoints return consistent JSON with:

- `searchParameters` - Query details
- `knowledgeGraph` - Knowledge panel (if available)
- `answerBox` - Direct answer (if available)
- `organic` - Main search results
- `peopleAlsoAsk` - Related questions
- `relatedSearches` - Related queries

## Notes

- Real-time Google results (not cached)
- Returns Knowledge Graph, Answer Box, People Also Ask
- Supports all major Google verticals
- Provides API access to Google search results and related endpoints such as web, images, maps, and knowledge-graph-style responses.
- Official pricing uses credit packs rather than a monthly subscription.
