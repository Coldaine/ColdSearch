# Epic 5: Remote Agentic Execution

**Status:** Deferred — not in the active four-PR sequence (PR1–PR4).

**Goal (when promoted):** CLI submits long-running research and batch work to a remote execution plane; workers run agentic flows (search → read → refine → synthesize) and normalized capability calls without blocking the terminal. The `coldsearch` CLI remains the operator surface; execution may run elsewhere.

This epic is **not** PR1–PR4. Those PRs extend the in-process CLI on `main`. Epic 5 is a separate track, opened only when explicitly prioritized.

---

## What problem it solves (later)

- Agent runs that outlive a shell session (submit, disconnect, poll or stream).
- Batch enrichment at volume without a single long-lived CLI process.
- Shared cache, concurrency, and rate limits across workers (when multiple processes exist).
- Trace correlation across agent steps and provider calls at job scale.

## What stays in ColdSearch (even with remote execution)

- Normalized capabilities: `search`, `extract`, `crawl`.
- Config-driven provider pools and routing policy (human control, not model-picked providers).
- Provider adapters and shared result schemas.
- SSRF policy on agent `fetch`.
- `ExecutionBackend` seam — today `LocalExecutionBackend`; future `RemoteExecutionBackend`.

The agent runtime does **not** need to be TypeScript. Tools should call ColdSearch capabilities (or the same backend the CLI uses), not raw vendor APIs.

## What we considered (June 2026) — not decided

Research and discussion reviewed packaged options instead of rolling custom daemon + SQLite state:

| Layer | Candidates | Notes |
| --- | --- | --- |
| Durable jobs / workers | [Hatchet](https://hatchet.run/), [Inngest](https://www.inngest.com/), [Trigger.dev](https://trigger.dev/) | Workflow orchestration and worker processes — **not** a place to “host the whole app.” Tasks invoke ColdSearch code; run state lives in the engine’s store. |
| Agent loop / tools | [Vercel AI SDK](https://ai-sdk.dev), [Mastra](https://mastra.ai/), [OpenAI Agents SDK JS](https://openai.github.io/openai-agents-js/), [LangGraph JS](https://langchain-ai.github.io/langgraphjs/) | TypeScript-friendly agent harnesses; pair with a durable layer for non-blocking runs. |
| Persistent agent product | [Hermes Agent](https://hermes-agent.org/) | Self-hosted agent OS (memory, scheduling, skills) — different category from embeddable SDK; integrate only if product direction fits. |
| Python-first orchestration | Agno, CrewAI, Pydantic AI, Google ADK | Valid if agent runtime is a separate service; ColdSearch core can remain TS. |
| Shared cache / rate limits | Redis | For cross-worker cache and key-pool coordination when more than one worker exists. |
| Explicitly rejected for this epic (for now) | Custom `coldsearchd`, hand-rolled SQLite for jobs/cache/keys, file-cache as multi-worker truth | Single-process JSON cache and JSONL usage are adequate until Epic 5 starts. |

**No framework or stack is chosen.** Hatchet and Inngest are the most discussed fits for `RemoteExecutionBackend` + batch + agent jobs; final pick is a decision at epic kickoff.

## Out of scope for Epic 5 (unless explicitly added)

- Replacing the four-PR local CLI work.
- Anthropic API as agent LLM (project policy: OpenAI-compatible providers only).
- Exposing every vendor tool in the CLI.
- MCP as the primary product interface (tool transport is fine; CLI + job API is the product).

## Promotion

Start Epic 5 only when:

- [ ] PR1–PR4 are merged or consciously descoped with a comment, **and**
- [ ] There is an explicit goal to implement `RemoteExecutionBackend` and non-blocking agent/batch runs, **and**
- [ ] A short ADR or plan update records the chosen execution + agent stack.

Until then, this document is the placeholder; do not block PR1–PR4 on remote infrastructure.
