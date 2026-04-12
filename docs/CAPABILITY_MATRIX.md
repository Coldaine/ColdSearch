# Provider Capability Matrix

**Last Updated:** 2026-04-12  
**Status:** Living Document - Update when adding providers or tools

This document maps all available tools across all providers. Use this to:
- Understand which providers support which capabilities
- Configure routing for specific tools
- Identify gaps in provider coverage

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully supported |
| ⚠️ | Partial/Limited support |
| ❌ | Not supported |
| 🆓 | Free tier available |
| 💰 | Paid only |

---

## Quick Reference: Tool to Provider Mapping

| Tool | Providers | Best For |
|------|-----------|----------|
| **Web Search** | Tavily, Brave, Exa, Serper, Jina | General search |
| **News Search** | Tavily, Brave, Serper | Current events |
| **Image Search** | Brave, Serper | Visual content |
| **Video Search** | Brave, Serper | Video content |
| **Find Similar** | Exa only | Semantic discovery |
| **URL Extraction** | Tavily, Firecrawl, Exa, Jina | Content extraction |
| **Structured Extraction** | Firecrawl only | Schema-based data |
| **Site Mapping** | Firecrawl, Tavily | URL discovery |
| **Site Crawling** | Firecrawl, Tavily | Full site extraction |
| **Research Report** | Tavily, Exa | Deep research |
| **Q&A** | Tavily, Exa | Direct answers |
| **Scholar Search** | Serper only | Academic papers |
| **Patent Search** | Serper only | Patent filings |
| **Autocomplete** | Brave, Serper | Search suggestions |
| **Embeddings** | Jina only | Vector search |
| **Reranking** | Jina only | Result ranking |

---

## Detailed Capability Matrix

### Search Tools

| Capability | Tavily | Firecrawl | Exa | Brave | Serper | Jina |
|------------|--------|-----------|-----|-------|--------|------|
| **Web Search** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **News Search** | ✅ (topic) | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Image Search** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Video Search** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Shopping Search** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Maps/Places** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Scholar Search** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Patent Search** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Semantic/Neural Search** | ⚠️ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Find Similar URLs** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Autocomplete** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

### Extraction Tools

| Capability | Tavily | Firecrawl | Exa | Brave | Serper | Jina |
|------------|--------|-----------|-----|-------|--------|------|
| **URL to Markdown** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Structured Extraction** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Screenshot Capture** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Batch Extraction** | ✅ (20 URLs) | ✅ (10K URLs) | ❌ | ❌ | ❌ | ❌ |
| **With JavaScript** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Browser Actions** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Discovery & Crawling Tools

| Capability | Tavily | Firecrawl | Exa | Brave | Serper | Jina |
|------------|--------|-----------|-----|-------|--------|------|
| **Site Map Discovery** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Recursive Crawling** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Deep Research** | ✅ | ❌ | ✅ | ❌ | ❌ | ⚠️ |
| **Agent-based Crawling** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

### AI/LLM Tools

| Capability | Tavily | Firecrawl | Exa | Brave | Serper | Jina |
|------------|--------|-----------|-----|-------|--------|------|
| **Direct Q&A** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Answer with Citations** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Chat Completions** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Research Synthesis** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Text Embeddings** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Result Reranking** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Summarization** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Utility Tools

| Capability | Tavily | Firecrawl | Exa | Brave | Serper | Jina |
|------------|--------|-----------|-----|-------|--------|------|
| **Spellcheck** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Autocomplete** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Custom Ranking** | ❌ | ❌ | ❌ | ✅ (Goggles) | ❌ | ❌ |
| **Reviews** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## Provider-Specific Tools Reference

### Tavily (7 tools)
1. `tavily_web_search` - Web search with AI snippets
2. `tavily_news_search` - News-specific search
3. `tavily_extract` - Extract content from URLs
4. `tavily_map` - URL discovery
5. `tavily_crawl` - Map + extract combined
6. `tavily_answer` - Q&A with citations
7. `tavily_research` - Multi-search synthesis

### Firecrawl (8 tools)
1. `firecrawl_scrape` - Single URL extraction
2. `firecrawl_crawl` - Recursive site crawling
3. `firecrawl_map` - URL discovery only
4. `firecrawl_search` - Search + extract
5. `firecrawl_extract` - Structured extraction
6. `firecrawl_interact` - Browser automation
7. `firecrawl_agent` - Autonomous agent
8. `firecrawl_batch` - Bulk processing

### Exa (6 tools)
1. `exa_search` - Neural/keyword/fast search
2. `exa_find_similar` - Semantic similarity
3. `exa_get_contents` - Retrieve by ID/URL
4. `exa_answer` - Direct answers
5. `exa_research` - Deep research
6. `exa_chat` - Chat completions

### Brave (7 tools)
1. `brave_web_search` - Web search
2. `brave_news_search` - News search
3. `brave_image_search` - Image search
4. `brave_video_search` - Video search
5. `brave_autocomplete` - Search suggestions
6. `brave_spellcheck` - Spell checking
7. `brave_llm_context` - LLM-optimized results

### Serper (11 tools)
1. `serper_web_search` - Google web search
2. `serper_image_search` - Google Images
3. `serper_news_search` - Google News
4. `serper_video_search` - Google Videos
5. `serper_shopping_search` - Google Shopping
6. `serper_maps_search` - Google Maps
7. `serper_places_search` - Google Places
8. `serper_scholar_search` - Google Scholar
9. `serper_patents_search` - Google Patents
10. `serper_autocomplete` - Google Suggest
11. `serper_get_reviews` - Place reviews

### Jina (6 tools)
1. `jina_reader` - URL to markdown
2. `jina_search` - Web search
3. `jina_deep_search` - Multi-step research
4. `jina_embeddings` - Text embeddings
5. `jina_rerank` - Result reranking
6. `jina_summarize` - Text summarization

---

## Free Tier Comparison

| Provider | Free Queries | Rate Limit | Best For |
|----------|--------------|------------|----------|
| **Tavily** | 1,000/month | 100/min | AI-optimized search |
| **Firecrawl** | 500 credits | 2 concurrent | Scraping & crawling |
| **Exa** | 1,000 | Standard | Semantic search |
| **Brave** | 2,000/month | 1/sec | Privacy-focused search |
| **Serper** | 2,500 | 300/sec | Google data access |
| **Jina** | 100 RPM / 1M tokens | 100/min | Free extraction |

---

## Configuration Examples

### Route by Tool Type

```toml
# Web search - any provider
[capabilities.web_search]
providers = ["tavily", "brave", "exa", "serper"]
strategy = "random"

# News - specific providers
[capabilities.news_search]
providers = ["tavily", "brave", "serper"]
strategy = "random"

# Find similar - Exa only
[capabilities.find_similar]
providers = ["exa"]
strategy = "random"

# Scholar - Serper only
[capabilities.scholar_search]
providers = ["serper"]
strategy = "random"

# Structured extraction - Firecrawl only
[capabilities.structured_extract]
providers = ["firecrawl"]
strategy = "random"

# Embeddings - Jina only
[capabilities.embeddings]
providers = ["jina"]
strategy = "random"
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-12 | Initial matrix with 6 providers, 45+ tools |

---

## TODO / Missing Implementations

- [ ] Add Perplexity provider (Sonar API)
- [ ] Add You.com provider
- [ ] Add Bing Search API
- [ ] Add Google Custom Search API
- [ ] Implement all 45+ tools in adapters
- [ ] Add tool discovery/registry system
