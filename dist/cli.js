#!/usr/bin/env node
import { loadConfig, getNextKey, getProviderConfig } from "./config.js";
import { TavilyAdapter } from "./adapters/tavily.js";
/**
 * Parse command line arguments into CLIOptions.
 */
function parseArgs(args) {
    const options = {
        query: "",
        limit: 10,
        pretty: false,
        json: false,
    };
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        switch (arg) {
            case "--limit":
            case "-l":
                i++;
                const limit = parseInt(args[i], 10);
                if (isNaN(limit) || limit < 1) {
                    throw new Error(`Invalid limit: ${args[i]}`);
                }
                options.limit = limit;
                break;
            case "--pretty":
            case "-p":
                options.pretty = true;
                break;
            case "--json":
            case "-j":
                options.json = true;
                break;
            case "--config":
            case "-c":
                i++;
                options.config = args[i];
                break;
            case "--help":
            case "-h":
                printHelp();
                process.exit(0);
                break;
            case "--version":
            case "-v":
                console.log("usearch v0.1.0");
                process.exit(0);
                break;
            default:
                if (!arg.startsWith("-")) {
                    // Collect query parts
                    options.query = args.slice(i).join(" ");
                    return options;
                }
                throw new Error(`Unknown option: ${arg}`);
        }
        i++;
    }
    return options;
}
function printHelp() {
    console.log(`
usearch - Unified search CLI

Usage: usearch [options] "<query>"

Options:
  -l, --limit N      Return at most N results (default: 10)
  -p, --pretty       Pretty print JSON output
  -j, --json         Force JSON output (default if not TTY)
  -c, --config PATH  Use custom config file
  -h, --help         Show this help
  -v, --version      Show version

Examples:
  usearch "what is firecrawl"
  usearch --limit 5 --pretty "machine learning"
  usearch -c ./my-config.toml "python async"
`);
}
/**
 * Main CLI entry point.
 */
async function main() {
    try {
        const args = process.argv.slice(2);
        if (args.length === 0) {
            printHelp();
            process.exit(1);
        }
        const options = parseArgs(args);
        if (!options.query.trim()) {
            console.error("Error: Query is required");
            printHelp();
            process.exit(1);
        }
        // Load configuration
        const config = loadConfig(options.config);
        // Get provider for basic_search capability
        const providers = config.capabilities.basic_search?.providers || [];
        if (providers.length === 0) {
            throw new Error("No providers configured for 'basic_search' capability");
        }
        // Phase 1: Single provider (Tavily)
        const providerName = providers[0];
        const providerConfig = getProviderConfig(config, providerName);
        // Get API key from pool (round-robin with index 0 for single request)
        const apiKey = getNextKey(providerConfig.keyPool, 0);
        // Create adapter (Phase 1: only Tavily)
        let adapter;
        if (providerName === "tavily") {
            adapter = new TavilyAdapter();
        }
        else {
            throw new Error(`Unknown provider: ${providerName}`);
        }
        // Execute search
        const results = await adapter.search(options.query, apiKey);
        // Apply limit
        const limitedResults = results.slice(0, options.limit);
        // Format output
        const output = {
            query: options.query,
            results: limitedResults,
            total: limitedResults.length,
        };
        // Determine output format
        const isTTY = process.stdout.isTTY;
        const shouldPrettyPrint = options.pretty || (!options.json && isTTY);
        if (shouldPrettyPrint) {
            console.log(JSON.stringify(output, null, 2));
        }
        else {
            console.log(JSON.stringify(output));
        }
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=cli.js.map