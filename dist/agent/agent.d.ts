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
export declare class SearchAgent {
    private llm;
    private fanout;
    private config;
    constructor(options?: AgentOptions);
    /**
     * Execute multi-step research on a goal.
     */
    research(goal: string, options?: AgentOptions): Promise<AgentResult>;
    /**
     * Fetch content from a URL.
     */
    private fetchContent;
    /**
     * Simple HTML to text extraction.
     */
    private extractTextFromHTML;
}
//# sourceMappingURL=agent.d.ts.map