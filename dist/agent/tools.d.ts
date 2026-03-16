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
export declare const searchTool: Tool;
/**
 * Fetch tool - retrieves content from a URL.
 */
export declare const fetchTool: Tool;
/**
 * Refine tool - generates a better search query.
 */
export declare const refineTool: Tool;
/**
 * Registry of all available tools.
 */
export declare const tools: Record<string, Tool>;
/**
 * Parse a tool call from agent output.
 * Format: tool_name("arg1", "arg2", ...)
 */
export declare function parseToolCall(text: string): {
    tool: string;
    args: string[];
} | null;
//# sourceMappingURL=tools.d.ts.map