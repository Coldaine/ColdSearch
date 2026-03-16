import { TavilyAdapter } from "./tavily.js";
import { BraveAdapter } from "./brave.js";
import { ExaAdapter } from "./exa.js";
import { SerperAdapter } from "./serper.js";
import type { SearchAdapter } from "../types.js";
/**
 * Registry of all available adapters.
 */
export declare const adapters: Record<string, new () => SearchAdapter>;
/**
 * Create an adapter instance by name.
 */
export declare function createAdapter(name: string): SearchAdapter;
/**
 * Get list of available adapter names.
 */
export declare function getAvailableAdapters(): string[];
export { TavilyAdapter, BraveAdapter, ExaAdapter, SerperAdapter };
//# sourceMappingURL=index.d.ts.map