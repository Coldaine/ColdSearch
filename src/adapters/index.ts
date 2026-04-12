import { BraveAdapter } from "./brave.js";
import { ExaAdapter } from "./exa.js";
import { FirecrawlAdapter } from "./firecrawl.js";
import { JinaAdapter } from "./jina.js";
import { SearXNGAdapter } from "./searxng.js";
import { SerperAdapter } from "./serper.js";
import { TavilyAdapter } from "./tavily.js";
import { createRegisteredAdapter, listRegisteredProviders } from "../providers.js";
import type { SearchAdapter } from "../types.js";

/**
 * Create an adapter instance by name.
 */
export function createAdapter(name: string): SearchAdapter {
  return createRegisteredAdapter(name);
}

/**
 * Get list of available adapter names.
 */
export function getAvailableAdapters(): string[] {
  return listRegisteredProviders();
}

export { TavilyAdapter, BraveAdapter, ExaAdapter, SerperAdapter, JinaAdapter, FirecrawlAdapter, SearXNGAdapter };
