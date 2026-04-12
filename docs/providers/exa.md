# Exa Provider

**Website:** https://exa.ai  
**API Docs:** https://docs.exa.ai  
**GitHub:** https://github.com/exa-labs/exa-js

## Overview

Exa is a neural search engine designed for AI applications. It uses embeddings-based "next-link prediction" to find semantically similar content rather than just keyword matching.

## Authentication

```bash
export EXA_API_KEY="..."
```

## Available Tools

### 1. `exa_search`

Neural/semantic web search with multiple modes.

**Endpoint:** `POST /search`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `type` | string | No | `"auto"`, `"neural"`, `"keyword"`, `"fast"` |
| `num_results` | number | No | Max results (default: 10) |
| `include_domains` | string[] | No | Whitelist domains |
| `exclude_domains` | string[] | No | Blacklist domains |
| `start_crawl_date` | string | No | ISO date (YYYY-MM-DD) |
| `end_crawl_date` | string | No | ISO date (YYYY-MM-DD) |
| `start_published_date` | string | No | ISO date |
| `end_published_date` | string | No | ISO date |
| `use_autoprompt` | boolean | No | Auto-expand query |
| `text` | boolean/object | No | Return text content |
| `highlights` | object | No | Highlight matching text |
| `summary` | object | No | Generate summary |

**Search Types:**
- `auto` - Intelligent routing between modes
- `neural` - Embeddings-based semantic search
- `keyword` - Traditional keyword search
- `fast` - Quick neural search (<350ms)

**Example:**
```json
{
  "query": "machine learning frameworks comparison",
  "type": "neural",
  "num_results": 10,
  "text": { "max_characters": 3000 },
  "highlights": {
    "query": "machine learning",
    "num_sentences": 2
  }
}
```

---

### 2. `exa_find_similar`

Find semantically similar pages to a given URL.

**Endpoint:** `POST /findSimilar`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Source URL |
| `num_results` | number | No | Max results |
| `exclude_source_domain` | boolean | No | Exclude source domain |
| `include_domains` | string[] | No | Whitelist domains |
| `exclude_domains` | string[] | No | Blacklist domains |
| `text` | boolean/object | No | Return text content |

**Example:**
```json
{
  "url": "https://waitbutwhy.com/2014/05/fermi-paradox.html",
  "num_results": 5,
  "exclude_source_domain": true,
  "text": true
}
```

**Use when:** Finding related content, research expansion, discovery.

---

### 3. `exa_get_contents`

Retrieve full content from URLs or document IDs.

**Endpoint:** `POST /contents`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | string[] | Yes | Document IDs or URLs |
| `text` | boolean/object | No | Return text content |
| `highlights` | object | No | Highlight query matches |
| `livecrawl` | string | No | `"always"`, `"preferred"`, `"fallback"`, `"never"` |
| `livecrawl_timeout` | number | No | Timeout in ms |

**Livecrawl Options:**
- `always` - Always fresh crawl
- `preferred` - Use fresh crawl if available
- `fallback` - Use cached, crawl if missing
- `never` - Use cached only

**Example:**
```json
{
  "ids": ["https://example.com/article"],
  "text": { "max_characters": 5000 },
  "livecrawl": "preferred"
}
```

---

### 4. `exa_answer`

Get direct answers to questions with citations.

**Endpoint:** `POST /answer`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Question to answer |
| `text` | boolean | No | Include source text |
| `stream` | boolean | No | Stream response |
| `model` | string | No | Model to use |
| `output_schema` | object | No | Structured output schema |

**Example:**
```json
{
  "query": "What is the population of New York City?",
  "text": true
}
```

**Returns:**
```json
{
  "answer": "8.3 million",
  "citations": [
    { "url": "...", "text": "..." }
  ]
}
```

---

### 5. `exa_research`

Automated in-depth research with structured output.

**Endpoint:** `POST /research` (async)

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Research topic |
| `plan` | string | No | Custom research plan |
| `num_suggestions` | number | No | Number of follow-ups |

**Example:**
```json
{
  "query": "Latest developments in quantum computing 2024",
  "plan": "Focus on commercial applications and major breakthroughs"
}
```

**Returns:** Research task ID (poll for completion)

**Output includes:**
- Executive summary
- Key findings with citations
- Detailed analysis sections
- Source list

---

### 6. `exa_chat`

Chat completions using Exa's web-grounded model.

**Endpoint:** `POST /chat/completions`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | `"exa"` |
| `messages` | array | Yes | Chat messages |
| `stream` | boolean | No | Stream response |
| `extra_body` | object | No | Additional options |

**Example:**
```json
{
  "model": "exa",
  "messages": [
    { "role": "user", "content": "What's new in AI?" }
  ],
  "extra_body": {
    "text": true
  }
}
```

---

## Provider Capability Matrix

| Tool | Endpoint | Free Tier | Notes |
|------|----------|-----------|-------|
| `exa_search` | /search | ✅ 1,000/mo | Neural/keyword/fast modes |
| `exa_find_similar` | /findSimilar | ✅ 1,000/mo | Semantic similarity |
| `exa_get_contents` | /contents | ✅ 1,000/mo | With livecrawl |
| `exa_answer` | /answer | ✅ 1,000/mo | Q&A with citations |
| `exa_research` | /research | ✅ 1,000/mo | Async deep research |
| `exa_chat` | /chat/completions | ✅ 1,000/mo | Web-grounded chat |

## Rate Limits

- Standard rate limits apply per tier
- Research endpoint has longer processing times

## Pricing

- **Free:** 1,000 credits (one-time or monthly - verify)
- **Paid plans:** Starting at usage-based pricing
- Research consumes more credits than search

## Search Types Explained

| Type | Speed | Use Case |
|------|-------|----------|
| `fast` | <350ms | Quick lookups, real-time apps |
| `neural` | 1-3s | Deep semantic understanding |
| `keyword` | <500ms | Exact matches, traditional search |
| `auto` | Varies | Intelligent mode selection |

## Notes

- Exa maintains its own web index
- "Find Similar" is unique - no other provider has this
- Research endpoint is powerful for complex queries
- Supports streaming for answer/chat endpoints
