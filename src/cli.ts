#!/usr/bin/env node

import { APP_NAME, LEGACY_APP_NAME, formatVersionString } from "./app.js";
import { SearchAgent } from "./agent/agent.js";
import { LocalExecutionBackend } from "./execution/backend.js";
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
        console.log(formatVersionString());
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
${APP_NAME} - Unified search CLI

Usage: ${APP_NAME} [command] [options] "<query|url>"

Compatibility alias: ${LEGACY_APP_NAME}

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
  ${APP_NAME} "what is firecrawl"
  ${APP_NAME} search "machine learning"
  ${APP_NAME} --providers tavily,brave --rerank rrf "rust async"
  
  # Extract content from URL
  ${APP_NAME} extract "https://example.com/article"
  
  # Crawl a website
  ${APP_NAME} crawl "https://example.com"
  ${APP_NAME} crawl --limit 5 "https://docs.example.com"
  
  # Use single random provider
  ${APP_NAME} --single-provider "query"
  
  # Agent mode
  ${APP_NAME} --agent "explain quantum computing"
  ${APP_NAME} --agent --max-steps 10 "latest fusion energy developments"
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
  const backend = new LocalExecutionBackend(options.config);

  const result = await backend.search(options.query, {
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
  const backend = new LocalExecutionBackend(options.config);

  const result = await backend.extract(options.query, {
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
  const backend = new LocalExecutionBackend(options.config);

  const result = await backend.crawl(options.query, {
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
    } else {
      await runFanoutMode(options);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
