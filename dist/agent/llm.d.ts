/**
 * LLM client interface for the search agent.
 * Supports multiple providers via a unified interface.
 */
export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface LLMOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
/**
 * LLM client interface.
 */
export interface LLMClient {
    complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}
/**
 * Anthropic Claude client.
 */
export declare class ClaudeClient implements LLMClient {
    private apiKey;
    private defaultModel;
    constructor(apiKey: string, model?: string);
    complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}
/**
 * OpenAI client.
 */
export declare class OpenAIClient implements LLMClient {
    private apiKey;
    private defaultModel;
    constructor(apiKey: string, model?: string);
    complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}
/**
 * Create an LLM client from environment.
 */
export declare function createLLMClient(provider?: "anthropic" | "openai", model?: string): LLMClient;
//# sourceMappingURL=llm.d.ts.map