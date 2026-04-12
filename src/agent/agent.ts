import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { APP_USER_AGENT } from "../app.js";
import {
  LocalExecutionBackend,
  type ExecutionBackend,
} from "../execution/backend.js";
import { fetchWithPolicy } from "../http.js";
import { createLLMClient, type LLMClient } from "./llm.js";
import { tools, parseAgentPayload } from "./tools.js";
import { ResearchContext } from "./context.js";

/**
 * Agent configuration options.
 */
export interface AgentOptions {
  /** Maximum research steps */
  maxSteps?: number;
  /** Maximum sources to collect */
  maxSources?: number;
  /** LLM provider */
  llmProvider?: "anthropic" | "openai";
  /** LLM model */
  model?: string;
  /** Config path */
  configPath?: string;
  /** Execution backend implementation */
  executionBackend?: ExecutionBackend;
}

function isIPv4InCidr(ip: string, network: string, prefixBits: number): boolean {
  const ipOctets = ip.split(".").map(Number);
  const networkOctets = network.split(".").map(Number);

  if (
    ipOctets.length !== 4 ||
    networkOctets.length !== 4 ||
    ipOctets.some(Number.isNaN) ||
    networkOctets.some(Number.isNaN)
  ) {
    return false;
  }

  const ipValue = ipOctets.reduce((value, octet) => ((value << 8) + octet) >>> 0, 0);
  const networkValue = networkOctets.reduce(
    (value, octet) => ((value << 8) + octet) >>> 0,
    0
  );
  const mask = prefixBits === 0 ? 0 : (~((1 << (32 - prefixBits)) - 1)) >>> 0;

  return (ipValue & mask) === (networkValue & mask);
}

function isBlockedIpAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const blockedCidrs: Array<[string, number]> = [
      ["127.0.0.0", 8],
      ["10.0.0.0", 8],
      ["172.16.0.0", 12],
      ["192.168.0.0", 16],
      ["169.254.0.0", 16],
      ["0.0.0.0", 8],
    ];

    return blockedCidrs.some(([network, prefixBits]) =>
      isIPv4InCidr(address, network, prefixBits)
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "metadata.google.internal" ||
    normalized === "metadata" ||
    normalized === "169.254.169.254"
  );
}

/**
 * Agent research result.
 */
export interface AgentResult {
  answer: string;
  sources: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
  steps: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
}

/**
 * Search Agent implementing ReAct-style reasoning.
 */
export class SearchAgent {
  private llm: LLMClient;
  private backend: ExecutionBackend;

  constructor(options: AgentOptions = {}) {
    this.llm = createLLMClient(options.llmProvider, options.model);
    this.backend = options.executionBackend ?? new LocalExecutionBackend(options.configPath);
  }

  /**
   * Execute multi-step research on a goal.
   */
  async research(goal: string, options: AgentOptions = {}): Promise<AgentResult> {
    const maxSteps = options.maxSteps || 5;
    const maxSources = options.maxSources || 5;
    
    const context = new ResearchContext(goal, maxSources);
    context.currentQuery = goal;

    const systemPrompt = `You are a research assistant that helps users find information. You have access to these tools:

- search("query"): Search the web for information
- fetch("url"): Fetch content from a URL  
- refine("current query", "intent"): Generate a better search query

Your task is to research the user's goal and provide a comprehensive answer. Follow this process:

1. SEARCH for initial information about the topic
2. FETCH promising sources to read more details
3. REFINE your search query if needed to find better information
4. Repeat steps 1-3 until you have sufficient information (max ${maxSteps} steps)
5. SYNTHESIZE a final answer with citations

When you want to use a tool, respond with ONLY a JSON object in this format:
{"type":"tool","tool":"search","args":["your query"]}

When you have enough information, respond with ONLY a JSON object in this format:
{"type":"final","answer":"Your comprehensive answer here with citations [1], [2], etc."}

Be thorough but efficient. Focus on authoritative sources.`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Research this goal: ${goal}` },
    ];

    for (let step = 0; step < maxSteps; step++) {
      // Get agent's next action
      const response = await this.llm.complete(messages);
      const content = response.content.trim();

      messages.push({ role: "assistant", content });

      const payload = parseAgentPayload(content);
      if (!payload) {
        messages.push({
          role: "user",
          content:
            'Invalid format. Respond with JSON only, using either {"type":"tool","tool":"search","args":["query"]} or {"type":"final","answer":"..."}',
        });
        continue;
      }

      if (payload.type === "final") {
        const result = context.generateResponse(payload.answer);
        return {
          answer: result.answer,
          sources: result.sources,
          steps: result.steps,
        };
      }

      const tool = tools[payload.tool];
      if (!tool) {
        messages.push({
          role: "user",
          content: `Unknown tool: ${payload.tool}. Available: search, fetch, refine`,
        });
        continue;
      }

      // Execute tool
      context.addStep(tool.name as any, JSON.stringify(payload));
      
      const toolContext = {
        query: context.currentQuery,
        llm: this.llm,
        searchFn: async (q: string) => {
          const result = await this.backend.search(q, {
            limit: 5,
            rerankStrategy: "rrf",
          });
          // Track sources
          result.results.forEach((r) => context.addSource(r));
          return result.results;
        },
        fetchFn: this.fetchContent.bind(this),
      };

      try {
        const toolResult = await tool.execute(toolContext, ...payload.args);
        messages.push({ role: "user", content: `Result:\n${toolResult}` });
      } catch (error) {
        messages.push({
          role: "user",
          content: `Error: ${(error as Error).message}`,
        });
      }
    }

    // Max steps reached - synthesize what we have
    const finalResponse = await this.llm.complete([
      ...messages,
      {
        role: "user",
        content: "Maximum steps reached. Please provide a FINAL ANSWER based on the information gathered.",
      },
    ]);

    const finalPayload = parseAgentPayload(finalResponse.content);
    const answer = finalPayload?.type === "final"
      ? finalPayload.answer
      : finalResponse.content;

    const result = context.generateResponse(answer);
    return {
      answer: result.answer,
      sources: result.sources,
      steps: result.steps,
    };
  }

  /**
   * Fetch content from a URL.
   */
  private async fetchContent(url: string): Promise<string> {
    const parsedUrl = await this.validateFetchUrl(url);
    const response = await fetchWithPolicy(parsedUrl, {
      headers: {
        "User-Agent": `Mozilla/5.0 (compatible; ${APP_USER_AGENT})`,
      },
    }, {
      label: "Agent fetch",
    });

    const contentType = response.headers.get("content-type") || "";
    
    if (contentType.includes("text/html")) {
      // Simple HTML to text extraction
      const html = await response.text();
      return this.extractTextFromHTML(html);
    }

    return await response.text();
  }

  private async validateFetchUrl(url: string): Promise<URL> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid fetch URL: ${url}`);
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported fetch URL protocol: ${parsedUrl.protocol}`);
    }

    if (isBlockedHostname(parsedUrl.hostname)) {
      throw new Error(`Refusing to fetch internal hostname: ${parsedUrl.hostname}`);
    }

    if (isBlockedIpAddress(parsedUrl.hostname)) {
      throw new Error(`Refusing to fetch non-public IP: ${parsedUrl.hostname}`);
    }

    const resolvedAddresses = await lookup(parsedUrl.hostname, { all: true, verbatim: true });
    if (resolvedAddresses.some((entry) => isBlockedIpAddress(entry.address))) {
      throw new Error(
        `Refusing to fetch hostname resolving to a non-public IP: ${parsedUrl.hostname}`
      );
    }

    return parsedUrl;
  }

  /**
   * Simple HTML to text extraction.
   */
  private extractTextFromHTML(html: string): string {
    // Remove script and style tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    
    // Replace common block elements with newlines
    text = text
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n\n");
    
    // Remove remaining tags
    text = text.replace(/<[^>]+>/g, "");
    
    // Decode entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
    
    // Normalize whitespace
    text = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");
    
    return text;
  }
}
