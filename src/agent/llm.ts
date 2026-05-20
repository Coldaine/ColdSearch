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

export type LLMProvider = "openai" | "groq" | "openrouter" | "cerebras" | "xai";

/**
 * OpenAI client.
 */
export class OpenAIClient implements LLMClient {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(apiKey: string, model = "gpt-4o", baseUrl = "https://api.openai.com/v1") {
    this.apiKey = apiKey;
    this.defaultModel = model;
    this.baseUrl = baseUrl;
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
    }>(`${this.baseUrl}/chat/completions`, {
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

const PROVIDER_ALIASES: Record<string, { baseUrl: string; defaultModel: string; envKey: string }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.1-70b-versatile", envKey: "GROQ_API_KEY" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o", envKey: "OPENROUTER_API_KEY" },
  cerebras: { baseUrl: "https://api.cerebras.ai/v1", defaultModel: "llama3.1-70b", envKey: "CEREBRAS_API_KEY" },
  xai: { baseUrl: "https://api.x.ai/v1", defaultModel: "grok-2", envKey: "XAI_GROK_API_KEY" },
};

/**
 * Create an LLM client from environment.
 * Anthropic is intentionally unsupported — do not add api.anthropic.com calls here.
 */
export function createLLMClient(
  provider: LLMProvider = "openai",
  model?: string,
  baseUrl?: string
): LLMClient {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }
    return new OpenAIClient(apiKey, model, baseUrl);
  }

  const alias = PROVIDER_ALIASES[provider];
  if (alias) {
    const apiKey = process.env[alias.envKey];
    if (!apiKey) {
      throw new Error(`${alias.envKey} environment variable not set`);
    }
    return new OpenAIClient(apiKey, model || alias.defaultModel, baseUrl || alias.baseUrl);
  }

  throw new Error(
    `Unsupported LLM provider \"${provider}\". Supported: openai, groq, openrouter, cerebras, xai.`
  );
}
