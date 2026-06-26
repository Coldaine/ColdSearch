# Cache And Observability

## Current

- Basic read-through file cache exists for search/extract.
- Usage logging exists as JSONL.
- Agent and provider paths have some structured errors and timings.

## Target

ColdSearch cache should become searchable recent result memory, not just exact request replay.

The retrieval path should:

1. Record search/extract/tool results with provider, tool, query or URL, timestamp, cache key, freshness metadata, and raw provider detail.
2. Search recent cached items before paying providers again.
3. Surface relevant prior items to the caller or agent with provenance.
4. Only replay an exact prior response when policy says it is fresh enough and the implementation is simple.

Observability should be rich enough to reconstruct how work flowed through the app:

- command/run ID
- provider/tool selected
- routing strategy and candidate providers
- key reference used, never the key value
- cache lookup, search, hit, miss, and selected prior items
- request timings
- retry attempts
- common-view and provider-specific errors
- agent tool calls and intermediate decisions
- output artifact paths

## Non-Secret Rule

Logs and cache metadata must not persist secret values. Key usage is recorded by safe reference only.
