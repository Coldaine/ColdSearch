/**
 * Explicit replay-safe provider-tool policy (PR 2).
 *
 * A provider tool is eligible for exact-response replay (`--freshness` /
 * `[cache].tool_ttl`) ONLY when it is listed here: its request shape produces
 * a stable exact cache key (the full redacted params object) and its semantics
 * are safe for replay (deterministic retrieval of the same request).
 *
 * Deliberately NOT eligible (history-only, always live):
 * - LLM-synthesized answers/research (`tavily.answer`, `exa.answer`,
 *   `tavily.research`, `brave.llmContext`) — output is generated, not retrieved.
 * - Broad site snapshots (`*.crawl`, `*.map`) — sensitive to site state,
 *   depth, and limit.
 * - Async jobs (`firecrawl.crawl`, `firecrawl.extract`) — a job handle is not
 *   a replayable result.
 * - Uncatalogued tools — replay safety is never inferred from cataloguing or
 *   synchronous execution alone.
 */
const REPLAY_SAFE_TOOL_IDS = new Set([
  "exa.search",
  "exa.findSimilar",
  "exa.contents",
  "tavily.search",
  "tavily.extract",
  "brave.webSearch",
  "serper.search",
  "jina.reader",
  "firecrawl.search",
  "firecrawl.scrape",
  "searxng.search",
]);

export function isReplaySafeTool(provider: string, tool: string): boolean {
  return REPLAY_SAFE_TOOL_IDS.has(`${provider}.${tool}`);
}

export function listReplaySafeTools(): string[] {
  return [...REPLAY_SAFE_TOOL_IDS].sort();
}
