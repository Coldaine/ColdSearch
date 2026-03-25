#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { FanoutEngine } from "./engine/fanout.js";
import { SearchAgent } from "./agent/agent.js";
import { createAdapter } from "./adapters/index.js";
import type { CLIOptions } from "./types.js";

/**
 * Extended CLI options including mode-specific options.
 */
interface ExtendedCLIOptions extends CLIOptions {
  /** Run in agent mode */
  agent?: boolean;
  /** Specific providers to use */
  providers?: string[];
  /** Reranker strategy */
  rerank?: "rrf" | "score" | "none";
  /** LLM provider for agent */
  llmProvider?: "anthropic" | "openai";
  /** LLM model for agent */
  model?: string;
  /** Maximum agent steps */
  maxSteps?: number;
  /** Maximum sources for agent */
  maxSources?: number;
}

/**
 * Parse command line arguments into CLIOptions.
 */
function parseArgs(args: string[]): ExtendedCLIOptions {
  const options: ExtendedCLIOptions = {
    command: "search",
    query: "",
    limit: 10,
    pretty: false,
    json: false,
    rerank: "rrf",
  };

  // Check if first arg is a command
  const commands = ["search", "extract", "crawl"];
  let i = 0;

  if (args.length > 0 && commands.includes(args[0])) {
    options.command = args[0] as "search" | "extract" | "crawl";
    i = 1;
  }

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

      case "--single-provider":
        options.singleProvider = true;
        break;

      case "--rerank":
        i++;
        const strategy = args[i];
        if (!["rrf", "score", "none"].includes(strategy)) {
          throw new Error(`Invalid rerank strategy: ${strategy}`);
        }
        options.rerank = strategy as "rrf" | "score" | "none";
        break;

      case "--llm":
        i++;
        const llm = args[i];
        if (!["anthropic", "openai"].includes(llm)) {
          throw new Error(`Invalid LLM provider: ${llm}`);
        }
        options.llmProvider = llm as "anthropic" | "openai";
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
        console.log("usearch v0.3.0");
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

function printHelp(): void {
  console.log(`
usearch - Unified search CLI

Usage: usearch [command] [options] "<query|url>"

Commands:
  search [options] "query"    Search the web (default)
  extract [options] "url"     Extract content from a URL
  crawl [options] "url"       Crawl a website

Options:
  Mode Selection:
    -a, --agent          Use search agent mode (multi-step research)
    --single-provider    Use one random provider instead of fanout
    
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
  # Search commands
  usearch "what is firecrawl"
  usearch search "machine learning"
  usearch --providers tavily,brave --rerank rrf "rust async"
  
  # Extract content from URL
  usearch extract "https://example.com/article"
  
  # Crawl a website
  usearch crawl "https://example.com"
  usearch crawl --limit 5 "https://docs.example.com"
  
  # Use single random provider
  usearch --single-provider "query"
  
  # Agent mode
  usearch --agent "explain quantum computing"
  usearch --agent --max-steps 10 "latest fusion energy developments"
`);
}

/**
 * Format output based on options.
 */
function formatOutput(data: unknown, options: ExtendedCLIOptions): string {
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
async function runFanoutMode(options: ExtendedCLIOptions): Promise<void> {
  const config = loadConfig(options.config);
  const engine = new FanoutEngine(config);

  const result = await engine.search(options.query, {
    limit: options.limit,
    providers: options.providers,
    rerankStrategy: options.rerank,
    singleProvider: options.singleProvider,
  });

  const output = {
    mode: options.singleProvider ? "single-provider" : "fanout",
    command: "search",
    query: options.query,
    results: result.results,
    providers_used: result.providersUsed,
    total: result.results.length,
    errors: Object.keys(result.errors).length > 0 ? result.errors : undefined,
  };

  console.log(formatOutput(output, options));
}

/**
 * Run extract mode.
 */
async function runExtractMode(options: ExtendedCLIOptions): Promise<void> {
  const config = loadConfig(options.config);
  const engine = new FanoutEngine(config);

  const result = await engine.extract(options.query, {
    limit: options.limit,
    providers: options.providers,
    singleProvider: options.singleProvider,
  });

  const output = {
    mode: options.singleProvider ? "single-provider" : "fanout",
    command: "extract",
    url: options.query,
    result: result.result,
    provider: result.provider,
    errors: result.errors ? result.errors : undefined,
  };

  console.log(formatOutput(output, options));
}

/**
 * Run crawl mode.
 */
async function runCrawlMode(options: ExtendedCLIOptions): Promise<void> {
  const config = loadConfig(options.config);
  const engine = new FanoutEngine(config);

  const result = await engine.crawl(options.query, {
    limit: options.limit,
    providers: options.providers,
    singleProvider: options.singleProvider,
  });

  const output = {
    mode: options.singleProvider ? "single-provider" : "fanout",
    command: "crawl",
    url: options.query,
    results: result.results,
    provider: result.provider,
    total: result.results.length,
    errors: result.errors ? result.errors : undefined,
  };

  console.log(formatOutput(output, options));
}

/**
 * Run Mode 2: Search Agent.
 */
async function runAgentMode(options: ExtendedCLIOptions): Promise<void> {
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
async function runLegacyMode(options: ExtendedCLIOptions): Promise<void> {
  const config = loadConfig(options.config);
  const providers = config.capabilities.search?.providers ||
    config.capabilities.basic_search?.providers || [];

  if (providers.length === 0) {
    throw new Error("No providers configured for 'search' capability");
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
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      printHelp();
      process.exit(1);
    }

    const options = parseArgs(args);

    if (!options.query.trim()) {
      console.error("Error: Query/URL is required");
      printHelp();
      process.exit(1);
    }

    // Route to appropriate mode
    if (options.agent) {
      await runAgentMode(options);
    } else if (options.command === "extract") {
      await runExtractMode(options);
    } else if (options.command === "crawl") {
      await runCrawlMode(options);
    } else if (options.providers || options.rerank !== "rrf" || options.singleProvider) {
      // Explicit fanout mode
      await runFanoutMode(options);
    } else {
      // Check if multiple providers configured
      const config = loadConfig(options.config);
      const providers = config.capabilities.search?.providers ||
        config.capabilities.basic_search?.providers || [];

      if (providers.length > 1) {
        await runFanoutMode(options);
      } else {
        await runLegacyMode(options);
      }
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
