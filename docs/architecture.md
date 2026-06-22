---
title: Architecture
date: 2026-06-22
author: Patrick MacLyman
status: living
doc_type: architecture
---

# Architecture

## Architecture Thesis

ColdSearch is one runtime that reaches multiple provider tools through a config-driven surface. The CLI (`coldsearch`) is Current; service, API, and MCP-style interfaces are Planned against the same core without duplicating provider logic (`docs/NORTH_STAR.md` G7).

Normalized capabilities (`search`, `extract`, `crawl`) are the common denominator. Useful vendor tools beyond those are exposed through a controlled provider-tool surface, not separate per-vendor CLIs or MCPs.

## Status Legend

- **Current** — implemented or directly reflected in the repo.
- **Planned** — decided direction, not fully implemented.
- **Candidate** — plausible option, not decided.
- **Deferred** — intentionally not being built now.

## System Shape

| Area | Status | Approach |
|------|--------|----------|
| CLI entrypoint | Current | `coldsearch` (+ `usearch` alias); search, extract, crawl, agent, status |
| Normalized capabilities | Current | `search`, `extract`, `crawl`; adapters + fanout/RRF |
| Provider-tool surface | Planned | Vendor tools beyond the three capabilities via ColdSearch |
| Config-driven routing | Current | `~/.config/coldsearch/config.toml`; provider pools per capability |
| Key and secret resolution | Current | Doppler-injected environment variables preferred; env refs, optional BWS refs, and keyless providers supported; per-process pools |
| Basic cache store | Current | Read-through file cache for search/extract |
| Searchable result memory | Planned | Index recent search/extract/tool results and surface relevant prior items before provider calls |
| Usage and audit logging | Current | JSONL usage log; richer flow logs and trace correlation Planned |
| Agent mode | Current | ReAct loop; OpenAI-compatible LLM dispatch |
| Service / API / MCP entrypoints | Planned | Same core, thin wrappers |
| Remote / hybrid execution | Planned | Async jobs behind CLI; centralized secrets |
| Batch enrichment | Planned | JSONL batch in/out with dedup and cache |

## Major Components

| Component | Status | Responsibility | Detail |
|-----------|--------|----------------|--------|
| Interface (`src/cli.ts`) | Current | Commands, JSON and human output | — |
| Execution backend | Current | Local seam for search, extract, crawl, agent | `docs/components/execution-backends.md` |
| Fanout engine | Current | Provider pools, fanout, RRF merge | `docs/ADRs/002-rrf-reranking.md` |
| Routing and request core | Current | Validation, keys, retries, timeouts, errors | `docs/components/routing-and-requests.md` |
| Provider adapters | Current | One module per vendor; shared schema | `docs/PROVIDERS.md` |
| Provider registry | Current | Capability matrix in code | `src/providers.ts` |
| Cache store | Current | Read-through JSON cache | `src/cache/` |
| Observability and result memory | Planned | Rich logs plus searchable recent prior work | `docs/components/cache-and-observability.md` |
| Agent | Current | ReAct + SSRF-safe fetch | `docs/ADRs/003-react-agent.md`, `docs/ADRs/004-ssrf-protection.md` |

## Architectural Invariants

- **Config over code.** Routing, pools, keys, cache policy, and endpoints live in TOML, not hardcoded switches.
- **Doppler for secret injection.** Operator secrets should enter the process through Doppler-managed environment injection where possible; ColdSearch code reads normal environment variables, explicit `env:` refs, optional `bws:` refs, or keyless provider config and must not log secret values.
- **Interface-agnostic core.** Routing, keys, retries, and normalization must not depend on whether the caller is CLI, API, or MCP (Planned entrypoints).
- **Comparable execution.** Fanout and per-provider error isolation enable cross-provider comparison (`docs/ADRs/001-fanout-architecture.md`).
- **Logging is a product surface.** Networked work, routing, cache lookup/retrieval, key selection by safe reference, retries, errors, timings, run IDs, and agent/tool flow should produce rich durable logs (`docs/NORTH_STAR.md` G5).
- **Searchable cache over blind replay.** Cache work should support retrieval over recent prior results. Exact response replay is secondary and should only be used where it is simple, explicit, and freshness-safe (`docs/NORTH_STAR.md` G4).
- **No lossy normalization.** Shared schemas are convenience; provider detail stays available when needed (`docs/NORTH_STAR.md` G6).
- **Provider coverage is documented.** Registry and `docs/PROVIDERS.md` Dual Matrix stay in sync (`npm run test:docs`).

## ADR Index

| ADR | Status | Summary |
|-----|--------|---------|
| `docs/ADRs/001-fanout-architecture.md` | accepted | Fanout with per-provider error isolation |
| `docs/ADRs/002-rrf-reranking.md` | accepted | RRF for cross-provider merge |
| `docs/ADRs/003-react-agent.md` | accepted | ReAct loop for agent mode |
| `docs/ADRs/004-ssrf-protection.md` | accepted | SSRF checks on agent fetch |

## Open Architecture Questions

- How should provider-tool calls be named and routed — capability extension vs explicit subcommand?
- Which entrypoint ships first after CLI: HTTP API, MCP server, or both?
- What cache freshness defaults balance hits vs stale results in agent loops?
- Should Doppler become documented as the default bootstrap path in `docs/CONFIGURATION.md` and `docs/KEY_MANAGEMENT.md`, with BWS retained as an optional explicit resolver?

## Links

- `docs/NORTH_STAR.md` — intent, goals, pillars
- `docs/PROVIDERS.md` — provider and tool matrix
- `docs/CONFIGURATION.md` — config reference
- `docs/DEVELOPER.md` — adapter contract
- `docs/components/` — subsystem detail
- `plans/` — active implementation plans (informational; not authority)
