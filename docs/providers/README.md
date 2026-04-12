# Provider Documentation

This directory contains detailed documentation for each search provider integrated with usearch.

## Available Providers

| Provider | File | Tools | Free Tier |
|----------|------|-------|-----------|
| **Tavily** | [tavily.md](tavily.md) | 7 | 1,000/mo |
| **Firecrawl** | [firecrawl.md](firecrawl.md) | 8 | 500 credits |
| **Exa** | [exa.md](exa.md) | 6 | 1,000 |
| **Brave** | [brave.md](brave.md) | 7 | 2,000/mo |
| **Serper** | [serper.md](serper.md) | 11 | 2,500 |
| **Jina** | [jina.md](jina.md) | 6 | Generous |

## Total: 45+ Tools Across 6 Providers

## Quick Links

- [Master Capability Matrix](../CAPABILITY_MATRIX.md) - See all providers vs all capabilities
- [NORTH_STAR.md](../NORTH_STAR.md) - Project vision and principles
- [architecture.md](../architecture.md) - Technical architecture

## Provider Selection Guide

### For Web Search
- **Best quality:** Tavily, Exa
- **Best free tier:** Serper (2,500), Brave (2,000)
- **Fastest:** Serper (1-2s), Brave
- **Most private:** Brave

### For Content Extraction
- **Best quality:** Firecrawl (JS rendering, screenshots)
- **Free option:** Jina Reader (no API key needed)
- **Batch processing:** Firecrawl (10K URLs)

### For Research
- **Deep research:** Tavily, Exa
- **Academic:** Serper (Scholar)
- **Multi-step:** Tavily Research, Exa Research

### For Discovery
- **Find similar:** Exa (unique capability)
- **Site mapping:** Firecrawl, Tavily
- **Semantic:** Exa

### For Specialized Search
- **Images/Videos:** Brave, Serper
- **Shopping:** Serper
- **Maps/Places:** Serper
- **Scholar/Patents:** Serper

## Implementation Status

| Provider | Status | Notes |
|----------|--------|-------|
| Tavily | ⚠️ Partial | Basic search/extract/crawl only |
| Firecrawl | ⚠️ Partial | Extract/crawl only |
| Exa | ⚠️ Partial | Search/extract only |
| Brave | ⚠️ Partial | Search only |
| Serper | ⚠️ Partial | Search only |
| Jina | ⚠️ Partial | Extract only |

**Next Steps:** Expand all adapters to full API surface (45+ tools)
