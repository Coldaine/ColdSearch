# Jina AI Provider

**Website:** https://jina.ai  
**API Docs:** https://github.com/jina-ai/reader

## Overview

Jina AI provides free and paid tools for reading, searching, and embedding web content. The Reader API converts URLs to LLM-friendly markdown without requiring an API key for basic usage.

## Authentication (Optional for basic usage)

```bash
# Optional - increases rate limits
export JINA_API_KEY="jina_..."
```

## Authentication

If you configure `JINA_API_KEY`, ColdSearch will send it as a bearer token. The current adapter also works without a key for basic Reader extraction.

## Configuration Example

```toml
[providers.jina]
[providers.jina.keyPool]
keys = ["env:JINA_API_KEY"]
```

## Capabilities

| Capability | Vendor | ColdSearch | Notes |
|------------|--------|------------|-------|
| `search` | ⚠️ | ❌ | Not wired in ColdSearch today |
| `extract` | ✅ | ✅ | Implemented by `extract()` in `src/adapters/jina.ts` |
| `crawl` | ⚠️ | ❌ | Not implemented |

## Available Tools

### 1. `jina_reader`

Extract clean markdown from any URL.

**Endpoint:** `GET https://r.jina.ai/http://{URL}` or `GET https://r.jina.ai/{URL}`

**Parameters (via URL or headers):**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to extract |

**Headers:**
| Header | Description |
|--------|-------------|
| `Authorization` | Bearer token (optional) |
| `Accept` | `text/plain` for plain text |

**Example:**
```bash
# Simple extraction
curl https://r.jina.ai/http://example.com/article

# With https
curl https://r.jina.ai/https://example.com/article

# Shorthand (assumes https)
curl https://r.jina.ai/example.com/article
```

**Response:** Clean markdown text

---

### 2. `jina_search`

Web search with extracted content.

**Endpoint:** `GET https://s.jina.ai/{query}`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |

**Example:**
```bash
curl https://s.jina.ai/what%20is%20machine%20learning
```

**Response:** Search results with extracted content

---

### 3. `jina_deep_search`

Multi-step deep research.

**Endpoint:** (Check latest API docs for endpoint)

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Research question |
| `depth` | string | No | Research depth level |

**Use when:** Complex research requiring multiple sources and synthesis.

---

### 4. `jina_embeddings`

Generate text embeddings.

**Endpoint:** `POST https://api.jina.ai/v1/embeddings`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Embedding model |
| `input` | string/array | Yes | Text to embed |
| `task` | string | No | `"text-matching"`, `"retrieval"`, etc. |
| `dimensions` | number | No | Output dimensions |
| `late_chunking` | boolean | No | Enable late chunking |

**Models:**
- `jina-embeddings-v3` (latest, multimodal)
- `jina-embeddings-v2-base-en`
- `jina-embeddings-v2-small-en`

**Example:**
```json
{
  "model": "jina-embeddings-v3",
  "input": ["Hello world", "Machine learning"],
  "task": "text-matching",
  "dimensions": 128
}
```

---

### 5. `jina_rerank`

Rerank documents by relevance.

**Endpoint:** `POST https://api.jina.ai/v1/rerank`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Reranker model |
| `query` | string | Yes | Query text |
| `documents` | array | Yes | Documents to rerank |
| `top_n` | number | No | Top results to return |

**Models:**
- `jina-reranker-v3`
- `jina-reranker-v2-base-multilingual`

**Example:**
```json
{
  "model": "jina-reranker-v3",
  "query": "machine learning frameworks",
  "documents": ["TensorFlow is...", "PyTorch provides...", "Scikit-learn..."],
  "top_n": 3
}
```

---

### 6. `jina_summarize`

Summarize text content.

**Endpoint:** Check latest API docs

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to summarize |
| `length` | string | No | Summary length |

---

## Provider Capability Matrix

| Tool | Endpoint | Free Tier | Notes |
|------|----------|-----------|-------|
| `jina_reader` | r.jina.ai | ✅ Generous | URL → markdown |
| `jina_search` | s.jina.ai | ✅ Yes | Web search |
| `jina_deep_search` | - | ✅ Limited | Multi-step research |
| `jina_embeddings` | api.jina.ai/v1/embeddings | ✅ 1M tokens | Text embeddings |
| `jina_rerank` | api.jina.ai/v1/rerank | ✅ Yes | Result reranking |
| `jina_summarize` | - | ✅ Yes | Text summarization |

## Rate Limits

- **Reader (no key):** 100 RPM
- **Reader (with key):** Higher limits
- **Embeddings:** 1M free tokens

## Pricing

- **Reader API:** Free for basic usage
- **Embeddings:** 1M free tokens, then pay-as-you-go
- **API Key:** Optional but increases limits

## ReaderLM

Jina's ReaderLM is a small language model (SLM) for:
- HTML to markdown conversion
- Content cleaning
- Noise removal
- Table extraction

## Notes

- **No API key required** for basic Reader usage
- Fast and reliable
- Excellent for quick URL-to-text extraction
- Embeddings and reranker require API key
- Supports multiple languages
- Multimodal embeddings available (v3)

## Use Cases

| Use Case | Best Tool |
|----------|-----------|
| Quick URL extraction | `jina_reader` |
| Free web search | `jina_search` |
| Build RAG pipeline | `jina_embeddings` + `jina_rerank` |
| Research synthesis | `jina_deep_search` |
