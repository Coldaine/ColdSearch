import type { NormalizedResult } from "../types.js";

/**
 * Reranker configuration options.
 */
export interface RerankerOptions {
  /** Maximum results to return */
  limit: number;
  /** Reranking strategy */
  strategy: "rrf" | "score" | "none";
  /** RRF constant k (default: 60) */
  rrfK?: number;
}

/**
 * Deduplicate results by URL, keeping the highest scoring entry.
 */
function deduplicate(results: NormalizedResult[]): NormalizedResult[] {
  const seen = new Map<string, NormalizedResult>();
  
  for (const result of results) {
    const url = result.url.toLowerCase().replace(/\/$/, "");
    const existing = seen.get(url);
    
    if (!existing || result.score > existing.score) {
      seen.set(url, result);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Reciprocal Rank Fusion (RRF) scoring.
 * Combines ranks from multiple result sets.
 * score = Σ 1 / (k + rank_i)
 */
function rrfScore(ranks: number[], k: number): number {
  return ranks.reduce((sum, rank) => sum + 1 / (k + rank), 0);
}

/**
 * Rerank results using Reciprocal Rank Fusion.
 */
function rerankRRF(
  resultsByProvider: Map<string, NormalizedResult[]>,
  k: number
): NormalizedResult[] {
  // Track ranks per URL per provider
  const urlRanks = new Map<string, Map<string, number>>();
  const urlData = new Map<string, NormalizedResult>();

  for (const [provider, results] of resultsByProvider) {
    results.forEach((result, index) => {
      const url = result.url.toLowerCase().replace(/\/$/, "");
      
      if (!urlRanks.has(url)) {
        urlRanks.set(url, new Map());
      }
      urlRanks.get(url)!.set(provider, index + 1); // 1-based rank
      
      // Keep the best metadata (highest score)
      const existing = urlData.get(url);
      if (!existing || result.score > existing.score) {
        urlData.set(url, result);
      }
    });
  }

  // Calculate RRF scores
  const scored: { result: NormalizedResult; score: number }[] = [];
  
  for (const [url, providerRanks] of urlRanks) {
    const ranks = Array.from(providerRanks.values());
    const rrf = rrfScore(ranks, k);
    const result = urlData.get(url)!;
    
    scored.push({
      result: { ...result, score: rrf },
      score: rrf,
    });
  }

  // Sort by RRF score descending
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map((s) => s.result);
}

/**
 * Simple score-based reranking (normalize and average).
 */
function rerankScore(
  resultsByProvider: Map<string, NormalizedResult[]>
): NormalizedResult[] {
  // Normalize scores per provider to 0-1 range
  const normalized: NormalizedResult[] = [];
  
  for (const [provider, results] of resultsByProvider) {
    if (results.length === 0) continue;
    
    const maxScore = Math.max(...results.map((r) => r.score));
    const minScore = Math.min(...results.map((r) => r.score));
    const range = maxScore - minScore || 1;
    
    for (const result of results) {
      normalized.push({
        ...result,
        score: (result.score - minScore) / range,
      });
    }
  }

  // Deduplicate and keep highest normalized score
  const deduped = deduplicate(normalized);
  
  // Sort by score descending
  deduped.sort((a, b) => b.score - a.score);
  
  return deduped;
}

/**
 * Rerank results from multiple providers.
 */
export function rerank(
  resultsByProvider: Map<string, NormalizedResult[]>,
  options: RerankerOptions
): NormalizedResult[] {
  let ranked: NormalizedResult[];

  switch (options.strategy) {
    case "rrf":
      ranked = rerankRRF(resultsByProvider, options.rrfK || 60);
      break;
    case "score":
      ranked = rerankScore(resultsByProvider);
      break;
    case "none":
      // Just flatten and deduplicate
      ranked = deduplicate(
        Array.from(resultsByProvider.values()).flat()
      );
      ranked.sort((a, b) => b.score - a.score);
      break;
    default:
      ranked = rerankRRF(resultsByProvider, 60);
  }

  return ranked.slice(0, options.limit);
}
