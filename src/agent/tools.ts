import type { NormalizedResult } from "../types.js";
import type { LLMClient } from "./llm.js";

/**
 * Tool context passed to all tools.
 */
export interface ToolContext {
  query: string;
  llm: LLMClient;
  searchFn: (query: string) => Promise<NormalizedResult[]>;
  fetchFn: (url: string) => Promise<string>;
}

/**
 * Tool definition.
 */
export interface Tool {
  name: string;
  description: string;
  execute(context: ToolContext, ...args: string[]): Promise<string>;
}

/**
 * Search tool - performs a web search.
 */
export const searchTool: Tool = {
  name: "search",
  description: "Search the web for information. Usage: search(\"your query\")",
  async execute(context: ToolContext, query: string): Promise<string> {
    const results = await context.searchFn(query);
    
    if (results.length === 0) {
      return "No results found.";
    }

    return results
      .slice(0, 5)
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet.substring(0, 200)}...`
      )
      .join("\n\n");
  },
};

/**
 * Fetch tool - retrieves content from a URL.
 */
export const fetchTool: Tool = {
  name: "fetch",
  description: "Fetch content from a URL. Usage: fetch(\"https://example.com\")",
  async execute(context: ToolContext, url: string): Promise<string> {
    try {
      const content = await context.fetchFn(url);
      // Truncate long content
      const maxLength = 8000;
      if (content.length > maxLength) {
        return content.substring(0, maxLength) + "\n\n[Content truncated...]";
      }
      return content;
    } catch (error) {
      return `Error fetching ${url}: ${(error as Error).message}`;
    }
  },
};

/**
 * Refine tool - generates a better search query.
 */
export const refineTool: Tool = {
  name: "refine",
  description:
    "Refine a search query based on context. Usage: refine(\"current query\", \"what you're looking for\")",
  async execute(
    context: ToolContext,
    currentQuery: string,
    intent: string
  ): Promise<string> {
    const response = await context.llm.complete([
      {
        role: "system",
        content:
          "You are a search query optimization expert. Given a current query and search intent, generate a more specific, targeted search query that will yield better results. Return ONLY the improved query, no explanation.",
      },
      {
        role: "user",
        content: `Current query: "${currentQuery}"\nSearch intent: ${intent}\n\nGenerate an improved search query:`,
      },
    ]);

    return response.content.trim();
  },
};

/**
 * Registry of all available tools.
 */
export const tools: Record<string, Tool> = {
  search: searchTool,
  fetch: fetchTool,
  refine: refineTool,
};

/**
 * Parse a tool call from agent output.
 * Format: tool_name("arg1", "arg2", ...)
 */
export function parseToolCall(
  text: string
): { tool: string; args: string[] } | null {
  const match = text.match(/^(\w+)\s*\(([^)]*)\)$/);
  if (!match) return null;

  const tool = match[1];
  const argsString = match[2];
  
  // Parse quoted arguments
  const args: string[] = [];
  const argMatches = argsString.matchAll(/"([^"]*)"/g);
  for (const argMatch of argMatches) {
    args.push(argMatch[1]);
  }

  return { tool, args };
}
