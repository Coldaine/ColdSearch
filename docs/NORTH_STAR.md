---
title: North Star
date: 2026-04-12
author: Patrick MacLyman
status: living
---

# North Star

## Why This Exists

Search providers expose overlapping tools and provider-specific interfaces. When the caller or model chooses directly among `tavily_search`, `brave_search`, `exa_search`, `serper_search`, or a self-hosted option like SearXNG, that choice is usually arbitrary. It burns credits unevenly, spreads secrets everywhere, and makes behavior hard to control. ColdSearch exists to invert that control: humans define the intent and the policy, and the system handles execution.

## In / Out / Shape

**In:** A query or URL, a normalized capability name (`search`, `extract`, `crawl`), and optional parameters.

**Out:** Normalized JSON in a consistent shape, regardless of which provider or execution environment produced it.

**Shape:** A CLI named `coldsearch`, with `usearch` kept as a compatibility alias during migration. Configuration lives at `~/.config/coldsearch/config.toml`, with legacy fallback to `~/.config/usearch/config.toml`. The CLI is the stable interface whether execution is local today or partially remote later.

## What This Is Not

- **Not direct provider exposure.** The caller should not need to think in vendor-specific tools or APIs.
- **Not model-directed routing.** The model or caller should not make arbitrary provider choices with incomplete information.
- **Not a remote job system yet.** Future remote execution is part of the direction, not the current product shape.
- **Not a provider mirror.** ColdSearch does not need to expose every vendor capability directly in the CLI.

## Goals

**G1: Unified Interface.** One command surface, multiple providers, consistent outputs.

**G2: Human Control.** Routing, rotation, provider pools, and execution policy are controlled by configuration rather than arbitrary runtime choices.

**G3: Normalized Output.** Different providers return different metadata; ColdSearch returns consistent shapes.

**G4: Stable CLI, Flexible Execution.** The CLI remains the interface even if execution later becomes partly remote or asynchronous.

## Pillars

**Config Over Code.** If routing or execution policy can be changed in config, it should not require code edits. Provider pools, endpoint choices, and rotation policy should be operational decisions.

**Opaque Execution.** The caller expresses intent. The runtime decides how that intent is executed without exposing unnecessary provider internals.

**Fail Visible.** When something breaks, the error should make it obvious whether the issue is config, credentials, provider reachability, or unsupported capability.

**Stable Interface.** The user-facing CLI should stay consistent even if the execution model evolves from local-only to hybrid local/remote operation.
