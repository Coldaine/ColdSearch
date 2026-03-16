---
title: North Star
date: 2026-03-16
author: Patrick MacLyman
status: living
---

# North Star

## Why This Exists

MCP servers expose search as N separate tools: `tavily_search`, `brave_search`, `exa_search`. The model picks whichever it wants. It has no basis for this decision and regularly burns through one provider's credits while others sit idle. This project inverts that control: humans configure which providers back which capabilities, and the system handles the rest.

## In / Out / Shape

**In:** A search query (string), a capability name (e.g., "basic_search"), and optional parameters (limit, format).

**Out:** An array of normalized results (title, URL, snippet, score, source) in consistent JSON.

**Shape:** CLI binary named `usearch`, installable via `npm install -g`, callable from any agent that can read a skill file. Configuration lives at `~/.config/usearch/config.toml` and controls provider mappings without code changes.

## What This Is Not

- **Not an MCP server.** MCP exposes N tools; the model picks. This exposes one interface; the human configures.
- **Not model-driven routing.** The agent never sees provider names, never picks which provider to use, never knows which adapter answered.
- **Not a research agent (yet).** Phase 1 is a single search call. Multi-step research is Mode 2, coming in Phase 4.
- **Not provider-specific.** Adding a new search provider should require editing one config file and nothing else.

## Goals

**G1: Unified Interface.** One command, multiple providers. The caller says "search" and gets results. How it happened is invisible.

**G2: Human Control.** Provider selection, key rotation, capability mapping — all configurable without touching code.

**G3: Normalized Output.** Every provider returns different metadata. The output schema is consistent regardless of what backed the query.

**G4: Agent-Native.** Install it, read the skill, use it. No setup scripts, no service management, no model retraining.

## Pillars

**Config Over Code.** If you can change it in a config file, you should never need a code change, rebuild, or redeploy. Why: Provider landscapes change faster than release cycles. A new API key or a provider swap should be a file edit, not a PR.

**Opaque Internals.** The agent-facing interface never exposes provider names, adapter details, or routing decisions. Why: If the agent can see providers, it might start making choices. The entire point is removing that choice.

**Fail Visible.** When something breaks, the error tells you what config to check. Why: This is infrastructure. When it fails, the user needs to know if their key is bad, their config is malformed, or a provider is down — not get a stack trace.
