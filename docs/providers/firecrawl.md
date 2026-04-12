# Firecrawl Provider

**Website:** https://firecrawl.dev  
**API Docs:** https://docs.firecrawl.dev/api-reference/introduction  
**GitHub:** https://github.com/mendableai/firecrawl

## Overview

Firecrawl turns websites into LLM-ready data. It handles JavaScript rendering, proxies, rate limits, and anti-bot measures automatically.

## Authentication

```bash
export FIRECRAWL_API_KEY="fc-..."
```

## Available Tools

### 1. `firecrawl_scrape`

Extract content from a single URL.

**Endpoint:** `POST /scrape`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to scrape |
| `formats` | string[] | No | `["markdown", "html", "screenshot", "links"]` |
| `only_main_content` | boolean | No | Remove headers/footers |
| `include_tags` | string[] | No | Specific HTML tags to include |
| `exclude_tags` | string[] | No | HTML tags to exclude |
| `headers` | object | No | Custom HTTP headers |
| `wait_for` | number | No | Wait time in ms |
| `timeout` | number | No | Request timeout in ms |
| `actions` | array | No | Pre-extraction actions |

**Example:**
```json
{
  "url": "https://example.com",
  "formats": ["markdown", "screenshot"],
  "only_main_content": true
}
```

---

### 2. `firecrawl_crawl`

Recursively crawl an entire website.

**Endpoint:** `POST /crawl`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Starting URL |
| `limit` | number | No | Max pages to crawl |
| `max_depth` | number | No | Max crawl depth |
| `include_paths` | string[] | No | URL patterns to include |
| `exclude_paths` | string[] | No | URL patterns to exclude |
| `scrape_options` | object | No | Options passed to /scrape |
| `webhook` | string | No | Webhook URL for completion |

**Example:**
```json
{
  "url": "https://docs.example.com",
  "limit": 100,
  "max_depth": 3,
  "scrape_options": {
    "formats": ["markdown"]
  }
}
```

**Returns:** Job ID (async, poll for results)

---

### 3. `firecrawl_map`

Discover all URLs on a website without extracting content.

**Endpoint:** `POST /map`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Website URL |
| `search` | string | No | Filter URLs by keyword |
| `limit` | number | No | Max URLs to return |
| `ignore_sitemap` | boolean | No | Skip sitemap.xml |
| `include_subdomains` | boolean | No | Include subdomains |

**Example:**
```json
{
  "url": "https://example.com",
  "limit": 1000,
  "search": "blog"
}
```

---

### 4. `firecrawl_search`

Search the web and extract content from results.

**Endpoint:** `POST /search`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `limit` | number | No | Max results (default: 5) |
| `lang` | string | No | Language code |
| `country` | string | No | Country code |
| `scrape_options` | object | No | Extraction options |

**Example:**
```json
{
  "query": "machine learning tutorials",
  "limit": 10,
  "scrape_options": {
    "formats": ["markdown"]
  }
}
```

---

### 5. `firecrawl_extract`

Structured data extraction using AI/Pydantic schemas.

**Endpoint:** `POST /extract` (or use `extract` with schema in /scrape)

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | string[] | Yes | URLs to extract from |
| `prompt` | string | No | Natural language extraction prompt |
| `schema` | object | No | JSON schema for structured output |
| `system_prompt` | string | No | System context for extraction |

**Example with Prompt:**
```json
{
  "urls": ["https://example.com/product"],
  "prompt": "Extract product name, price, and description"
}
```

**Example with Schema:**
```json
{
  "urls": ["https://example.com/product"],
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "price": { "type": "number" },
      "description": { "type": "string" }
    }
  }
}
```

---

### 6. `firecrawl_interact`

Interact with page before extraction (click, scroll, type).

**Endpoint:** `POST /scrape` (with `actions`)

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to interact with |
| `actions` | array | Yes | Array of actions |

**Actions:**
```json
{
  "actions": [
    { "type": "click", "selector": "#button" },
    { "type": "type", "selector": "#input", "text": "hello" },
    { "type": "scroll", "direction": "down", "amount": 500 },
    { "type": "wait", "milliseconds": 2000 },
    { "type": "screenshot" }
  ]
}
```

---

### 7. `firecrawl_agent`

Autonomous browser agent for complex tasks.

**Endpoint:** `POST /agent`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Task description |
| `url` | string | No | Starting URL |
| `max_steps` | number | No | Max agent steps |
| `variables` | object | No | Variables for prompt |

**Example:**
```json
{
  "prompt": "Find the pricing page and extract all plan details",
  "url": "https://example.com",
  "max_steps": 10
}
```

---

### 8. `firecrawl_batch`

Scrape thousands of URLs asynchronously.

**Endpoint:** `POST /batch/scrape`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | string[] | Yes | Up to 10,000 URLs |
| `scrape_options` | object | No | Options for each scrape |

**Example:**
```json
{
  "urls": ["https://example.com/1", "https://example.com/2", "..."],
  "scrape_options": {
    "formats": ["markdown"]
  }
}
```

---

## Provider Capability Matrix

| Tool | Endpoint | Async | Notes |
|------|----------|-------|-------|
| `firecrawl_scrape` | /scrape | ❌ | Single URL, immediate |
| `firecrawl_crawl` | /crawl | ✅ | Job-based, poll results |
| `firecrawl_map` | /map | ❌ | Fast URL discovery |
| `firecrawl_search` | /search | ❌ | Search + extract |
| `firecrawl_extract` | /extract | ❌ | Structured extraction |
| `firecrawl_interact` | /scrape | ❌ | With actions |
| `firecrawl_agent` | /agent | ✅ | Autonomous agent |
| `firecrawl_batch` | /batch/scrape | ✅ | Bulk processing |

## Rate Limits

As of 2026-04-12. Sources: https://docs.firecrawl.dev/rate-limits and https://www.firecrawl.dev/pricing

- **Free:** 2 concurrent browsers
- **Hobby:** 5 concurrent browsers
- **Standard:** 50 concurrent browsers
- **Growth:** 100 concurrent browsers
- **Scale / Enterprise:** 150+ concurrent browsers

## Pricing (Credits)

As of 2026-04-12. Sources: https://www.firecrawl.dev/pricing and https://docs.firecrawl.dev/billing

- **Free:** 500 credits (one-time)
- **Hobby:** 3,000 credits/month, $16/month when billed yearly
- **Standard:** 100,000 credits/month, $83/month when billed yearly
- **Growth:** 500,000 credits/month, $333/month when billed yearly
- **Scale:** 1,000,000 credits/month, $599/month when billed yearly
- Paid plans are available with monthly or yearly billing; yearly billing is discounted.

## Credit Costs

| Operation | Credits |
|-----------|---------|
| Scrape (standard) | 1 |
| Crawl (per page) | 1 |
| Map (per call) | 1 |
| Search | 2 / 10 results |
| Browser | 2 / browser minute |
| Agent | Dynamic |

## Notes

- Supports self-hosted version
- Integrates with LangChain, LlamaIndex, CrewAI
- MCP server available
- 96% web coverage including JS-heavy sites
- Billing details and credit modifiers are documented in the official billing docs.
