/**
 * LLM client interface for the search agent.
 * OpenAI only — ColdSearch does not call the Anthropic API.
 */
import { APP_USER_AGENT } from "../app.js";
import { fetchJson } from "../http.js";

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

export type LLMProvider = "openai";

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
    const data = await fetchJson<{
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    }>("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": APP_USER_AGENT,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
      }),
    }, {
      label: "OpenAI completion",
    });

    return {
      content: data.choices?.[0]?.message?.content || "",
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens:
              data.usage.total_tokens ??
              ((data.usage.prompt_tokens ?? 0) +
                (data.usage.completion_tokens ?? 0)),
          }
        : undefined,
    };
  }
}

/**
 * Create an LLM client from environment.
 * Anthropic is intentionally unsupported — do not add api.anthropic.com calls here.
 */
export function createLLMClient(
  provider: LLMProvider = "openai",
  model?: string
): LLMClient {
  if (provider !== "openai") {
    throw new Error(
      `Unsupported LLM provider "${provider}". ColdSearch agent mode uses OpenAI only (OPENAI_API_KEY).`
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable not set");
  }
  return new OpenAIClient(apiKey, model);
}
