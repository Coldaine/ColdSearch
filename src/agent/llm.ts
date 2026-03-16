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
export class ClaudeClient implements LLMClient {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, model = "claude-3-sonnet-20240229") {
    this.apiKey = apiKey;
    this.defaultModel = model;
  }

  async complete(
    messages: LLMMessage[],
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.2,
        messages: messages.filter((m) => m.role !== "system"),
        system: messages.find((m) => m.role === "system")?.content,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ text?: string }>;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };
    
    return {
      content: data.content?.[0]?.text || "",
      usage: data.usage,
    };
  }
}

/**
 * OpenAI client.
 */
export class OpenAIClient implements LLMClient {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.apiKey = apiKey;
    this.defaultModel = model;
  }

  async complete(
    messages: LLMMessage[],
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };
    
    return {
      content: data.choices?.[0]?.message?.content || "",
      usage: data.usage,
    };
  }
}

/**
 * Create an LLM client from environment.
 */
export function createLLMClient(
  provider: "anthropic" | "openai" = "anthropic",
  model?: string
): LLMClient {
  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable not set");
    }
    return new ClaudeClient(apiKey, model);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }
  return new OpenAIClient(apiKey, model);
}
