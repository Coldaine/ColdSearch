# Execution Backends

## Local backend (Current)

`LocalExecutionBackend` is the only implemented backend. All `search`, `extract`, `crawl`, and agent work runs in-process on the operator's machine.

## Hybrid and remote (Planned)

Per the Architecture Thesis:

1. CLI, API, or MCP client submits a job.
2. Remote executor runs provider calls and small-agent orchestration.
3. Client polls or fetches the final result.

Goals: centralized secrets, tractable async jobs, retries and state with the executor.

The same core should surface as CLI, service, API, and MCP entrypoints without forking provider logic.
