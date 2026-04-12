# SearXNG Adoption Plan

## Objective
Integrate SearXNG as a zero-cost, privacy-preserving metasearch provider for the `usearch` CLI. This includes providing the necessary Docker configuration within the repository to easily stand up a local SearXNG instance with JSON support enabled, and an adapter to route search queries to it.

## Key Files & Context
- `docker-compose.yml` (New): To stand up the local SearXNG instance.
- `docker/searxng/settings.yml` (New): Configuration for the SearXNG container to enable JSON output formats.
- `src/adapters/searxng.ts` (New): The adapter implementing `SearchAdapter`.
- `src/adapters/index.ts`: To register the new adapter.
- `config.example.toml`: To include SearXNG configuration.
- `README.md`: To update documentation.

## Implementation Steps

### 1. Docker Stand-up Configuration
- Create a `docker-compose.yml` in the project root to define the `searxng` service (using the `searxng/searxng` image, mapping port 8889 to 8080).
- Create `docker/searxng/settings.yml` with the following critical configuration to enable JSON format, which AI agents require:
  ```yaml
  search:
    formats:
      - html
      - json
  ```
- Mount this `settings.yml` into the Docker container via the compose file.

### 2. Create the SearXNG Adapter (`src/adapters/searxng.ts`)
- Implement `SearchAdapter` (`name: "searxng"`, `capabilities: ["basic_search"]`).
- Implement the `search(query: string)` method. Since we control the local stand-up, the adapter will default to `http://localhost:8889` directly without relying on an environment variable or secret key.
- Fetch from `http://localhost:8889/search?q={query}&format=json`.
- Map the JSON `results` array to the standard `NormalizedResult` schema (title, url, snippet, score, source: "searxng").

### 3. Register the Adapter
- Export `SearxngAdapter` in `src/adapters/index.ts`.

### 4. Update CLI Configuration
- In `config.example.toml`, add `"searxng"` to `capabilities.search.providers`.
- Add a `[providers.searxng]` section. Since it doesn't need an API key, we will provide an empty `keyPool` (like Jina) or directly specify `url = "http://localhost:8889"` if the config schema allows it.

### 5. Update Documentation
- Add instructions to `README.md` on how to start the provider: `docker compose up -d`.
- Add SearXNG to the providers table indicating it is free and self-hosted.

## Verification & Testing
1. Run `docker compose up -d` to stand up the local engine.
2. Verify it responds to JSON queries by navigating to or curling `http://localhost:8889/search?q=test&format=json`.
3. Set `usearch` configuration to use the `searxng` provider.
4. Run `usearch search "machine learning" --providers searxng` and verify normalized JSON results are printed to stdout.