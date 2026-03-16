#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { FanoutEngine } from "./engine/fanout.js";
import { SearchAgent } from "./agent/agent.js";
import { createAdapter } from "./adapters/index.js";
/**
 * Parse command line arguments into CLIOptions.
 */
function parseArgs(args) {
    const options = {
        query: "",
        limit: 10,
        pretty: false,
        json: false,
        rerank: "rrf",
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
            case "--agent":
            case "-a":
                options.agent = true;
                break;
            case "--providers":
                i++;
                options.providers = args[i].split(",").map((p) => p.trim());
                break;
            case "--rerank":
                i++;
                const strategy = args[i];
                if (!["rrf", "score", "none"].includes(strategy)) {
                    throw new Error(`Invalid rerank strategy: ${strategy}`);
                }
                options.rerank = strategy;
                break;
            case "--llm":
                i++;
                const llm = args[i];
                if (!["anthropic", "openai"].includes(llm)) {
                    throw new Error(`Invalid LLM provider: ${llm}`);
                }
                options.llmProvider = llm;
                break;
            case "--model":
                i++;
                options.model = args[i];
                break;
            case "--max-steps":
                i++;
                options.maxSteps = parseInt(args[i], 10);
                break;
            case "--max-sources":
                i++;
                options.maxSources = parseInt(args[i], 10);
                break;
            case "--help":
            case "-h":
                printHelp();
                process.exit(0);
                break;
            case "--version":
            case "-v":
                console.log("usearch v0.2.0");
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
  Mode Selection:
    -a, --agent          Use search agent mode (multi-step research)
    
  Fanout Options (default mode):
    --providers LIST     Comma-separated providers (default: all configured)
    --rerank STRATEGY    Reranker: rrf|score|none (default: rrf)
    
  Agent Options (requires --agent):
    --llm PROVIDER       LLM provider: anthropic|openai (default: anthropic)
    --model MODEL        LLM model name
    --max-steps N        Maximum research steps (default: 5)
    --max-sources N      Maximum sources to collect (default: 5)
    
  General Options:
    -l, --limit N        Return at most N results (default: 10)
    -p, --pretty         Pretty print JSON output
    -j, --json           Force JSON output
    -c, --config PATH    Use custom config file
    -h, --help           Show this help
    -v, --version        Show version

Examples:
  # Mode 1: Fanout + Rerank (default)
  usearch "what is firecrawl"
  usearch --providers tavily,brave --rerank rrf "machine learning"
  
  # Mode 2: Search Agent
  usearch --agent "explain quantum computing"
  usearch --agent --max-steps 10 "latest fusion energy developments"
`);
}
/**
 * Format output based on options.
 */
function formatOutput(data, options) {
    const isTTY = process.stdout.isTTY;
    const shouldPrettyPrint = options.pretty || (!options.json && isTTY);
    if (shouldPrettyPrint) {
        return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
}
/**
 * Run Mode 1: Fanout + Rerank.
 */
async function runFanoutMode(options) {
    const config = loadConfig(options.config);
    const engine = new FanoutEngine(config);
    const result = await engine.search(options.query, {
        limit: options.limit,
        providers: options.providers,
        rerankStrategy: options.rerank,
    });
    const output = {
        mode: "fanout",
        query: options.query,
        results: result.results,
        providers_used: result.providersUsed,
        total: result.results.length,
        errors: Object.keys(result.errors).length > 0 ? result.errors : undefined,
    };
    console.log(formatOutput(output, options));
}
/**
 * Run Mode 2: Search Agent.
 */
async function runAgentMode(options) {
    const agent = new SearchAgent({
        configPath: options.config,
        llmProvider: options.llmProvider,
        model: options.model,
        maxSteps: options.maxSteps,
        maxSources: options.maxSources,
    });
    const result = await agent.research(options.query, {
        maxSteps: options.maxSteps,
        maxSources: options.maxSources,
    });
    const output = {
        mode: "agent",
        goal: options.query,
        answer: result.answer,
        sources: result.sources,
        steps: result.steps.length,
    };
    console.log(formatOutput(output, options));
}
/**
 * Run legacy single-provider mode (backward compatibility).
 */
async function runLegacyMode(options) {
    const config = loadConfig(options.config);
    const providers = config.capabilities.basic_search?.providers || [];
    if (providers.length === 0) {
        throw new Error("No providers configured for 'basic_search' capability");
    }
    // Use first provider (single-provider mode for backward compat)
    const providerName = providers[0];
    const adapter = createAdapter(providerName);
    // Get API key
    const providerConfig = config.providers[providerName];
    if (!providerConfig) {
        throw new Error(`Provider '${providerName}' not found in config`);
    }
    const keyRef = providerConfig.keyPool.keys[0];
    if (!keyRef) {
        throw new Error(`No API key configured for provider '${providerName}'`);
    }
    const apiKey = keyRef.startsWith("env:")
        ? process.env[keyRef.slice(4)] || ""
        : keyRef;
    if (!apiKey) {
        throw new Error(`Environment variable ${keyRef.slice(4)} is not set`);
    }
    const results = await adapter.search(options.query, apiKey);
    const limitedResults = results.slice(0, options.limit);
    const output = {
        query: options.query,
        results: limitedResults,
        total: limitedResults.length,
    };
    console.log(formatOutput(output, options));
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
        // Route to appropriate mode
        if (options.agent) {
            await runAgentMode(options);
        }
        else if (options.providers || options.rerank !== "rrf") {
            // Explicit fanout mode
            await runFanoutMode(options);
        }
        else {
            // Check if multiple providers configured
            const config = loadConfig(options.config);
            const providers = config.capabilities.basic_search?.providers || [];
            if (providers.length > 1) {
                await runFanoutMode(options);
            }
            else {
                await runLegacyMode(options);
            }
        }
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=cli.js.map