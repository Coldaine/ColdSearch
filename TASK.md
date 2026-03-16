# Task: Build Phase 1 — Single-Provider CLI

## Read First

Read these docs in order before writing any code:

1. `docs/NORTH_STAR.md`
2. `docs/architecture.md`
3. `docs/PROGRESS.md`
4. `SKILL.md`
5. `config.example.toml`

## What Phase 1 Proves

That the CLI+skill delivery model works end to end. An agent reads SKILL.md, calls `usearch "query"`, gets back JSON results. One provider, one adapter, no fanout, no rerank, no search agent. Just the vertical slice from CLI invocation to normalized results on stdout.

## What to Build

### 1. Project scaffold

TypeScript. Node. ESM modules. Set up:

- `package.json` with `"bin": { "usearch": "./dist/cli.js" }`
- `tsconfig.json` targeting ES2022, Node module resolution
- A `src/` directory
- `npm run build` compiles to `dist/`
- `npm link` makes `usearch` available globally for local dev

### 2. Config loader

- Reads a config file (use TOML; the example is already in that format)
- Resolves key references to environment variables at runtime
- Exposes: which providers are mapped to which capabilities, and the key pool for each provider
- Config file location: `~/.config/usearch/config.toml` with `--config` flag override

### 3. One adapter: Tavily

- `src/adapters/tavily.ts`
- Implements a `SearchAdapter` interface:
  - `name: string`
  - `capabilities: string[]` (for now just `["basic_search"]`)
  - `search(query: string, apiKey: string): Promise<NormalizedResult[]>`
- Calls Tavily's search API (`tavily` npm package)
- Normalizes the response to the shared result schema

### 4. Result schema

- `src/types.ts`
- `NormalizedResult`: `title`, `url`, `snippet`, `score` (relevance, 0-1 normalized), `source` (provider name, for internal debugging only)
- This will evolve. Don't overthink it. Get something that captures the basics.

### 5. CLI entry point

- `src/cli.ts`
- Parses args: `usearch "query"` and `usearch --limit N --pretty --json "query"`
- Loads config
- Picks a key from the Tavily pool (round-robin; just track an index)
- Calls the adapter
- Prints JSON to stdout

### 6. SKILL.md validation

- After the CLI works, test it by actually having an agent read SKILL.md and invoke `usearch "test query"` from a Claude Code session
- If the agent can't figure out how to call it from the skill alone, the skill is wrong. Fix the skill, not the agent.

## What NOT to Build

- No fanout. One provider.
- No reranker.
- No `--agent` mode.
- No key rotation strategy beyond a simple index counter.
- No error retry / fallback to alternate providers.
- No tests yet (Phase 1 is proving the shape; tests come when there's more than one adapter to keep honest).

## Done When

- `usearch "what is firecrawl"` returns JSON results to stdout
- An agent reading SKILL.md can call it successfully without additional prompting
- `npm install -g` from the repo makes `usearch` globally available
- Config file at `~/.config/usearch/config.toml` controls which Tavily key is used

## Then

Update `docs/PROGRESS.md` to reflect Phase 1 complete. Do not start Phase 2 without talking to me first.
