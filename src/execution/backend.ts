import { loadConfig } from "../config.js";
import { FanoutEngine, type FanoutOptions } from "../engine/fanout.js";
import type { CrawlResult, ExtractResult, NormalizedResult } from "../types.js";

export interface ExecutionBackend {
  search(query: string, options: FanoutOptions): Promise<{
    results: NormalizedResult[];
    providersUsed: string[];
    errors: Record<string, string>;
  }>;
  extract(url: string, options: FanoutOptions): Promise<{
    result: ExtractResult | null;
    provider: string;
    errors?: Record<string, string>;
  }>;
  crawl(url: string, options: FanoutOptions): Promise<{
    results: CrawlResult[];
    provider: string;
    errors?: Record<string, string>;
  }>;
}

export class LocalExecutionBackend implements ExecutionBackend {
  private readonly engine: FanoutEngine;

  constructor(configPath?: string) {
    const config = loadConfig(configPath);
    this.engine = new FanoutEngine(config);
  }

  search(query: string, options: FanoutOptions) {
    return this.engine.search(query, options);
  }

  extract(url: string, options: FanoutOptions) {
    return this.engine.extract(url, options);
  }

  crawl(url: string, options: FanoutOptions) {
    return this.engine.crawl(url, options);
  }
}
