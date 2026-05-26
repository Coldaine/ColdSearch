# ADR 002: Reciprocal Rank Fusion (RRF) for Cross-Provider Reranking

**Date:** 2026-04-12
**Status:** Accepted

## Context

When multiple search providers return results for the same query, ColdSearch needs to merge and rerank them into a single, coherent result list. Each provider has its own relevance scoring algorithm with different scales and semantics. Simple score normalization is fragile and provider-dependent.

## Decision

**Use Reciprocal Rank Fusion (RRF) as the default reranking strategy.**

RRF scores each result as: `score = 1 / (k + rank)` where `k` is a constant (default 60) and `rank` is the result's position in its provider's result list (1-indexed). This means:

- A result ranked #1 by Tavily gets `1/(60+1) ≈ 0.0164`
- A result ranked #1 by Brave gets the same score — provider agnostic
- A result ranked #10 gets `1/(60+10) ≈ 0.0143` — smooth decay
- A result appearing in multiple provider lists gets its scores summed — boost for cross-provider agreement

## Alternatives Considered

### Provider score normalization (min-max or z-score)
Rejected. Each provider's score semantics differ. Tavily uses relevance scores, Brave uses a proprietary ranking, Exa uses semantic similarity. Normalizing across these without understanding each provider's distribution produces misleading merged rankings.

### Score-based ranking (use provider scores directly)
Rejected. Provider scores are not comparable. A Tavily score of 0.9 and a Brave score of 0.9 mean different things.

### No reranking (concatenate lists)
Rejected. Results from the first provider in the array would dominate. No cross-provider signal integration.

## Consequences

**Positive:**
- Provider-agnostic — works with any provider without understanding their scoring
- Rewards cross-provider agreement (same URL ranked high by multiple providers gets boosted)
- Smooth rank decay prevents domination by top results
- Simple, well-understood algorithm with academic backing

**Negative:**
- Ignores provider-specific relevance signals entirely
- Treats all providers as equally authoritative
- No quality weighting per provider (future work)

## Implementation

- `src/engine/reranker.ts` — RRF implementation with configurable `k`
- Default `k = 60` per Cormack et al. (2009)
- `none` strategy available for raw concatenation
- `score` strategy available for provider-score-based ranking (experimental)
