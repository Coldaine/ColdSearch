import { TavilyAdapter } from "./tavily.js";
import { BraveAdapter } from "./brave.js";
import { ExaAdapter } from "./exa.js";
import { SerperAdapter } from "./serper.js";
/**
 * Registry of all available adapters.
 */
export const adapters = {
    tavily: TavilyAdapter,
    brave: BraveAdapter,
    exa: ExaAdapter,
    serper: SerperAdapter,
};
/**
 * Create an adapter instance by name.
 */
export function createAdapter(name) {
    const AdapterClass = adapters[name];
    if (!AdapterClass) {
        throw new Error(`Unknown adapter: ${name}`);
    }
    return new AdapterClass();
}
/**
 * Get list of available adapter names.
 */
export function getAvailableAdapters() {
    return Object.keys(adapters);
}
export { TavilyAdapter, BraveAdapter, ExaAdapter, SerperAdapter };
//# sourceMappingURL=index.js.map