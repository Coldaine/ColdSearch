# Search History, Cache, And Observability

## Current

- Basic read-through file cache exists for search/extract.
- Usage logging exists as JSONL.
- Agent and provider paths have some structured errors and timings.

## Target: Research Memory

Search history/research memory is the user-facing concept. The exact-response cache is an implementation mechanism with separate freshness and replay policy; it must not define the exploration surface.

The retrieval path should:

1. Give every meaningful search/extract/crawl/tool execution an execution ID.
2. Record the original request, native parameters, routing decision, normalized output, raw provider detail, result URLs/artifact references, failures, provider/tool, timings, safe key reference, live/cache status, run ID, and agent step where applicable.
3. Preserve fanout results by provider as well as the merged result so recurring and unique URLs remain inspectable.
4. Support recent/search/show/compare exploration and surface related prior work with provenance.
5. Permit intentional reuse while clearly displaying age and source.
6. Only replay an exact prior response when cache policy says it is fresh enough and replay is explicit and simple.

Provider-effectiveness analysis should operate on accumulated records and must not initiate paid provider calls as part of normal validation.

Build this by extending the execution detail already preserved by normalized paths, usage logging, and the generic provider-tool substrate. Do not create a second observability system or require annotations/scoring.

Observability should be rich enough to reconstruct how work flowed through the app:

- command/run ID
- provider/tool selected
- routing strategy and candidate providers
- key reference used, never the key value
- history retrieval, related-item selection, intentional reuse, and exact-cache hit/miss
- request timings
- retry attempts
- normalized and provider-specific errors
- agent tool calls and intermediate decisions
- output artifact paths

## Non-Secret Rule

Logs and cache metadata must not persist secret values. Key usage is recorded by safe reference only.
