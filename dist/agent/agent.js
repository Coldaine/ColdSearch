import { FanoutEngine } from "../engine/fanout.js";
import { loadConfig } from "../config.js";
import { createLLMClient } from "./llm.js";
import { tools, parseToolCall } from "./tools.js";
import { ResearchContext } from "./context.js";
/**
 * Search Agent implementing ReAct-style reasoning.
 */
export class SearchAgent {
    llm;
    fanout;
    config;
    constructor(options = {}) {
        this.config = loadConfig(options.configPath);
        this.llm = createLLMClient(options.llmProvider, options.model);
        this.fanout = new FanoutEngine(this.config);
    }
    /**
     * Execute multi-step research on a goal.
     */
    async research(goal, options = {}) {
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

When you want to use a tool, respond with ONLY the tool call:
search("your query")
fetch("https://example.com")
refine("current query", "what you need")

When you have enough information, respond with:
FINAL ANSWER:
Your comprehensive answer here with citations [1], [2], etc.

Be thorough but efficient. Focus on authoritative sources.`;
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Research this goal: ${goal}` },
        ];
        for (let step = 0; step < maxSteps; step++) {
            // Get agent's next action
            const response = await this.llm.complete(messages);
            const content = response.content.trim();
            messages.push({ role: "assistant", content });
            // Check for final answer
            if (content.includes("FINAL ANSWER:")) {
                const answer = content.split("FINAL ANSWER:")[1].trim();
                const result = context.generateResponse(answer);
                return {
                    answer: result.answer,
                    sources: result.sources,
                    steps: result.steps,
                };
            }
            // Parse and execute tool call
            const toolCall = parseToolCall(content);
            if (!toolCall) {
                messages.push({
                    role: "user",
                    content: "Invalid format. Please use tool calls like search(\"query\") or respond with FINAL ANSWER:",
                });
                continue;
            }
            const tool = tools[toolCall.tool];
            if (!tool) {
                messages.push({
                    role: "user",
                    content: `Unknown tool: ${toolCall.tool}. Available: search, fetch, refine`,
                });
                continue;
            }
            // Execute tool
            context.addStep(tool.name, `${tool.name}(${toolCall.args.join(", ")})`);
            const toolContext = {
                query: context.currentQuery,
                llm: this.llm,
                searchFn: async (q) => {
                    const result = await this.fanout.search(q, {
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
                const toolResult = await tool.execute(toolContext, ...toolCall.args);
                messages.push({ role: "user", content: `Result:\n${toolResult}` });
            }
            catch (error) {
                messages.push({
                    role: "user",
                    content: `Error: ${error.message}`,
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
        const answer = finalResponse.content.includes("FINAL ANSWER:")
            ? finalResponse.content.split("FINAL ANSWER:")[1].trim()
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
    async fetchContent(url) {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; USearch/0.1)",
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
            // Simple HTML to text extraction
            const html = await response.text();
            return this.extractTextFromHTML(html);
        }
        return await response.text();
    }
    /**
     * Simple HTML to text extraction.
     */
    extractTextFromHTML(html) {
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
//# sourceMappingURL=agent.js.map