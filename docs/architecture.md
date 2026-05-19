---
title: Architecture
date: 2026-05-19
author: Patrick MacLyman
status: living
doc_type: architecture
---

# Architecture

## Current Shape

ColdSearch is a CLI-first system with three normalized capabilities:

| Capability | Intent | Current providers |
|------------|--------|-------------------|
| `search` | find web results | SearXNG, Tavily, Exa, Brave, Serper |
| `extract` | retrieve page content | Tavily, Exa, Jina, Firecrawl |
| `crawl` | gather content across a site | Tavily, Firecrawl |

These are not the full provider surfaces. They are the normalized interface ColdSearch exposes today.

## Actual Source Model

The runtime is driven by provider overlap:

1. Vendors expose overlapping tool surfaces.
2. ColdSearch groups that overlap into normalized capabilities.
3. Config defines which providers back each capability.
4. Runtime selects from that configured pool.
5. Adapters normalize output into shared schemas.

`docs/CAPABILITY_MATRIX.md` is the required comparison document for this layer.

## Layers

### 1. Interface Layer

- `coldsearch` CLI is the current entrypoint.
- A future remote executor may expose the same core behind async jobs.
- The CLI should remain usable in both local and future hybrid modes.

### 2. Execution Backend Layer

- Local execution is the only implemented backend today.
- The backend boundary exists so remote execution can be added later.
- Agent mode is the most likely first consumer of remote async execution.

### 3. Shared Routing/Core Layer

- capability lookup
- provider-pool selection
- provider validation
- key/secret resolution
- retry/timeout policy
- normalization and reranking

This is the layer that must stay interface-agnostic.

### 4. Provider Adapter Layer

One adapter per provider. Adapters convert provider-specific APIs into normalized ColdSearch schemas and use the shared request policy.

### 5. Documentation and Registry Layer

- provider registry in code defines implemented capabilities and provider docs linkage
- provider docs explain vendor surface area
- capability matrix records both vendor surface and ColdSearch implementation status

## Routing Policy

Current routing is manual random pools by capability.

- operators configure which providers belong to a capability pool
- runtime picks randomly from that pool when configured for random selection
- runtime does not silently hop to another provider after choosing one in this phase

This keeps behavior explicit while still distributing load.

## Request Lifecycle

All networked operations should run through shared request handling with:

- explicit timeouts
- abort control
- bounded transient retries
- normalized error reporting

This applies to provider adapters and LLM calls.

## Agent Mode

ColdSearch includes a ReAct-style research agent (`src/agent/agent.ts`). It is invoked with `--agent` and uses an LLM to drive multi-step research.

### Agent Loop

```
User goal → LLM plans → tool execution → LLM observes → repeat → synthesize
```

The agent goes through cycles of:
1. **Plan** — LLM receives system prompt + conversation history and decides next action
2. **Execute** — the agent parses a structured JSON payload and runs the requested tool
3. **Observe** — tool output is fed back into the conversation
4. **Repeat** — up to `maxSteps` (default 5), then forced synthesis

Each LLM response must be a JSON object: `{"type":"tool","tool":"search","args":["query"]}` or `{"type":"final","answer":"..."}`. Malformed responses trigger a format-correction retry from the system prompt.

If max steps are reached without a final answer, the agent appends a forced-synthesis instruction. If that also fails, it retries once more with stricter formatting.

### Tools

Three tools are available to the agent, defined in `src/agent/tools.ts`:

| Tool | Args | What it does |
|------|------|-------------|
| `search` | `[query]` | Fanout search via the execution backend, returns normalized results with RRF scores |
| `fetch` | `[url]` | Fetches and extracts text from a URL (HTML → plain text) |
| `refine` | `[currentQuery, intent]` | Uses the LLM to generate a better search query from the current one + expressed intent |

Tools execute through a `ToolContext` that provides the search function, fetch function, and LLM client. This keeps the tool definitions provider-agnostic.

### SSRF Protection

The agent's `fetchContent()` method (`src/agent/agent.ts`) implements multi-layer protection against Server-Side Request Forgery:

1. **Protocol check** — only `http:` and `https:` allowed
2. **Hostname blocklist** — `localhost`, `.localhost`, `metadata.google.internal`, `169.254.169.254`
3. **IP blocklist** — all RFC 1918 private ranges, loopback, link-local, unique local IPv6
4. **DNS resolution check** — resolves the hostname and checks all returned addresses against the IP blocklist (catches DNS rebinding)
5. **IPv4-mapped IPv6 detection** — extracts and checks embedded IPv4 in `::ffff:x.x.x.x` addresses
6. **Content-type enforcement** — only `text/html`, `application/xhtml+xml`, and `text/*` accepted
7. **Body size cap** — 1MB maximum fetch body
8. **Timeout** — 10-second fetch timeout

### Research Context

`src/agent/context.ts` tracks the agent's state across steps:

- Source deduplication by URL
- Step logging with timestamps
- Source cap enforcement (`maxSources`)
- Citation formatting (appends `\n\nSources:\n[1] Title (url)\n[2] ...` to final answer)

### LLM Provider Model

`src/agent/llm.ts` provides a unified `LLMClient` interface with two implementations:

- `ClaudeClient` — Anthropic Messages API (`https://api.anthropic.com/v1/messages`)
- `OpenAIClient` — OpenAI-compatible chat completions (`{baseUrl}/chat/completions`)

Provider aliases auto-configure base URL, default model, and environment variable:

| Alias | Base URL | Default Model | Env Key |
|-------|----------|--------------|---------|
| `anthropic` | `https://api.anthropic.com/v1` | `claude-3-sonnet-20240229` | `ANTHROPIC_API_KEY` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o` | `OPENAI_API_KEY` |
| `groq` | `https://api.groq.com/openai/v1` | `llama-3.1-70b-versatile` | `GROQ_API_KEY` |
| `openrouter` | `https://openrouter.ai/api/v1` | `openai/gpt-4o` | `OPENROUTER_API_KEY` |
| `cerebras` | `https://api.cerebras.ai/v1` | `llama3.1-70b` | `CEREBRAS_API_KEY` |
| `xai` | `https://api.x.ai/v1` | `grok-2` | `XAI_GROK_API_KEY` |

Custom endpoints are supported via `--llm-base-url` for any OpenAI-compatible API.

### System Prompt

The agent receives a structured system prompt that:
- Declares the available tools and their signatures
- Prescribes the ReAct research process (search → fetch → refine → repeat → synthesize)
- Requires structured JSON responses (tool calls and final answers)
- Sets the max step count from configuration

The user's goal becomes the first user message in the conversation.

## Future Hybrid Direction

The long-term target is not MCP. The long-term target is hybrid execution with the CLI still in front.

Future flow:

1. CLI submits a job.
2. Remote executor performs provider calls and small-agent orchestration.
3. CLI polls status or fetches the final result.

The point of that future mode is centralization:

- secrets live in one place
- async job handling becomes tractable
- retries and state live with the executor

## Non-Goals For This Phase

- no remote executor yet
- no container-based workflow on this laptop
- no provider-hopping fallback after selection
- no attempt to expose every vendor tool directly in the CLI
- no streaming agent responses (SSE)
- no agent mode as a long-running service