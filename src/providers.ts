import { BraveAdapter } from "./adapters/brave.js";
import { ExaAdapter } from "./adapters/exa.js";
import { FirecrawlAdapter } from "./adapters/firecrawl.js";
import { JinaAdapter } from "./adapters/jina.js";
import { SearXNGAdapter } from "./adapters/searxng.js";
import { SerperAdapter } from "./adapters/serper.js";
import { TavilyAdapter } from "./adapters/tavily.js";
import type { CapabilityName, Config } from "./types.js";
import type { SearchAdapter } from "./types.js";

export interface ProviderMetadata {
  displayName: string;
  capabilities: CapabilityName[];
  docsPath: string;
  selfHosted?: boolean;
  optionKeys?: string[];
  createAdapter: () => SearchAdapter;
}

export const providerRegistry = {
  tavily: {
    displayName: "Tavily",
    capabilities: ["search", "extract", "crawl"],
    docsPath: "docs/providers/tavily.md",
    createAdapter: () => new TavilyAdapter(),
  },
  brave: {
    displayName: "Brave",
    capabilities: ["search"],
    docsPath: "docs/providers/brave.md",
    createAdapter: () => new BraveAdapter(),
  },
  exa: {
    displayName: "Exa",
    capabilities: ["search", "extract", "crawl"],
    docsPath: "docs/providers/exa.md",
    createAdapter: () => new ExaAdapter(),
  },
  serper: {
    displayName: "Serper",
    capabilities: ["search"],
    docsPath: "docs/providers/serper.md",
    createAdapter: () => new SerperAdapter(),
  },
  jina: {
    displayName: "Jina",
    capabilities: ["extract"],
    docsPath: "docs/providers/jina.md",
    createAdapter: () => new JinaAdapter(),
  },
  firecrawl: {
    displayName: "Firecrawl",
    capabilities: ["search", "extract", "crawl"],
    docsPath: "docs/providers/firecrawl.md",
    createAdapter: () => new FirecrawlAdapter(),
  },
  searxng: {
    displayName: "SearXNG",
    capabilities: ["search"],
    docsPath: "docs/providers/searxng.md",
    selfHosted: true,
    optionKeys: ["baseUrl"],
    createAdapter: () => new SearXNGAdapter(),
  },
} satisfies Record<string, ProviderMetadata>;

export type ProviderName = keyof typeof providerRegistry;

export function listRegisteredProviders(): ProviderName[] {
  return Object.keys(providerRegistry) as ProviderName[];
}

export function getProviderMetadata(provider: string): ProviderMetadata {
  const metadata = providerRegistry[provider as ProviderName];
  if (!metadata) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return metadata;
}

export function providerSupportsCapability(
  provider: string,
  capability: CapabilityName
): boolean {
  return getProviderMetadata(provider).capabilities.includes(capability);
}

export function createRegisteredAdapter(provider: string): SearchAdapter {
  return getProviderMetadata(provider).createAdapter();
}

/**
 * Shared provider resolution logic used by both CLI dry-run and FanoutEngine.
 * Validates config/capability and applies strategy (all vs random).
 */
export function resolveCapabilityProviders(
  config: Config,
  capability: CapabilityName,
  options: { providers?: string[]; singleProvider?: boolean }
): { providers: string[] } {
  const capConfig = config.capabilities[capability];
  if (!capConfig) {
    throw new Error(`No configuration found for capability: ${capability}`);
  }

  const selected = options.providers && options.providers.length > 0
    ? options.providers
    : capConfig.providers;

  if (!selected.length) {
    throw new Error(`No providers configured for ${capability}`);
  }

  for (const provider of selected) {
    if (!config.providers[provider]) {
      throw new Error(`Provider '${provider}' is not configured`);
    }
    if (!providerSupportsCapability(provider, capability)) {
      throw new Error(`Provider '${provider}' does not implement capability '${capability}'`);
    }
  }

  const useSingleProvider = options.singleProvider || capConfig.strategy === "random";
  if (!useSingleProvider) return { providers: selected };

  const randomIndex = Math.floor(Math.random() * selected.length);
  return { providers: [selected[randomIndex]] };
}
