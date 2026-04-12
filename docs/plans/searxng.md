# SearXNG Adoption Plan

## Objective

Integrate SearXNG as a self-hosted or operator-managed search provider for ColdSearch without binding the product to any specific host or assuming local containers.

## Product Constraints

- ColdSearch must not assume `localhost`.
- ColdSearch must not require local Docker on `icarus-laptop`.
- SearXNG should be configured through an explicit provider endpoint (`baseUrl`) rather than overloading API-key configuration.
- Optional self-hosting assets may remain in-repo for another machine, but they are infrastructure aids, not the default product workflow.

## Scope

### In scope

- `src/adapters/searxng.ts`
- provider registry entry
- `config.example.toml` example using `providers.searxng.options.baseUrl`
- `docs/providers/searxng.md`
- `docs/CAPABILITY_MATRIX.md`

### Out of scope

- choosing the final host
- implementing a remote orchestration backend
- prescribing a local-container workflow for this laptop

## Runtime Contract

- Provider name: `searxng`
- Current capability: `search`
- Required configuration: `providers.searxng.options.baseUrl` or `SEARXNG_BASE_URL`
- Key pool: empty by default

## Verification

1. Configure a reachable SearXNG base URL.
2. Verify `GET /search?q=test&format=json` works against that endpoint.
3. Run `coldsearch search --providers searxng "machine learning"`.
4. Verify normalized results are returned.

## Follow-up Questions

- where SearXNG will ultimately run
- whether repo-local infrastructure assets should remain after hosting is decided
- whether SearXNG should later participate in any remote/hybrid execution backend
