# ADR 003: ReAct Agent Loop for Multi-Step Research

**Date:** 2026-04-20
**Status:** Accepted

## Context

ColdSearch needed a mode that goes beyond single-query search — multi-step research that searches, reads sources, refines queries, and synthesizes an answer. This requires an agent that can reason about search strategy, execute tool calls, and produce a final answer.

## Decision

**Implement a ReAct (Reasoning + Acting) agent loop with structured JSON tool payloads.**

The agent follows a cycle:
1. LLM receives system prompt + conversation history
2. LLM responds with a JSON payload: either a tool call or a final answer
3. If tool call: agent executes the tool and feeds output back as a user message
4. If final answer: agent returns the synthesized result with citations
5. Repeat until max steps or final answer

Tool payloads use structured JSON (`{"type":"tool","tool":"search","args":["query"]}`) rather than regex parsing of free-form text. This eliminates parsing ambiguity and lets the LLM express multi-argument tool calls naturally.

## Alternatives Considered

### XML/function-calling tool format
Rejected. Adds parsing complexity. JSON is simpler for both the LLM to generate and the agent to parse. The system prompt explicitly constrains the output format to JSON only.

### Free-form text with regex extraction
Rejected. Ambiguous parsing. LLMs produce inconsistent formatting for tool calls in free text. Structured output is more reliable.

### Streaming agent responses
Deferred. Adds complexity (partial JSON parsing, incremental tool execution). Not needed for the current local-execution model. Will be reconsidered when remote/hybrid execution is implemented.

### LangChain/LlamaIndex agent frameworks
Rejected. ColdSearch is a focused CLI tool, not a general agent platform. The ReAct loop is ~200 lines in `agent.ts`. Adding a framework dependency for this would be overkill.

## Consequences

**Positive:**
- Simple, auditable loop — the entire agent is in one file (`src/agent/agent.ts`)
- Structured tool calls eliminate parsing ambiguity
- Max-steps guardrail prevents infinite loops
- Forced synthesis on step exhaustion ensures the agent always produces output
- Format-correction retries handle malformed LLM responses gracefully

**Negative:**
- No tool call validation before execution (trusts LLM to provide valid tool names)
- No parallel tool execution (tools run sequentially)
- No streaming — user waits for the full agent run to complete
- System prompt is hardcoded, not configurable

## Implementation

- `src/agent/agent.ts` — `SearchAgent.research()` implements the ReAct loop
- `src/agent/tools.ts` — tool definitions (search, fetch, refine)
- `src/agent/context.ts` — `ResearchContext` tracks sources, steps, and generates citations
- `parseAgentPayload()` — JSON parsing with retry on malformed input
