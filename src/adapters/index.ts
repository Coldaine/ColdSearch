import { TavilyAdapter } from "./tavily.js";
import { BraveAdapter } from "./brave.js";
import { ExaAdapter } from "./exa.js";
import { SerperAdapter } from "./serper.js";
import { JinaAdapter } from "./jina.js";
import { FirecrawlAdapter } from "./firecrawl.js";
import { SearXNGAdapter } from "./searxng.js";
import type { SearchAdapter } from "../types.js";

/**
 * Registry of all available adapters.
 */
export const adapters: Record<string, new () => SearchAdapter> = {
  tavily: TavilyAdapter,
  brave: BraveAdapter,
  exa: ExaAdapter,
  serper: SerperAdapter,
  jina: JinaAdapter,
  firecrawl: FirecrawlAdapter,
  searxng: SearXNGAdapter,
};

/**
 * Create an adapter instance by name.
 */
export function createAdapter(name: string): SearchAdapter {
  const AdapterClass = adapters[name];
  if (!AdapterClass) {
    throw new Error(`Unknown adapter: ${name}`);
  }
  return new AdapterClass();
}

/**
 * Get list of available adapter names.
 */
export function getAvailableAdapters(): string[] {
  return Object.keys(adapters);
}

export { TavilyAdapter, BraveAdapter, ExaAdapter, SerperAdapter, JinaAdapter, FirecrawlAdapter, SearXNGAdapter };
