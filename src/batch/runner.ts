import { loadConfig } from "../config.js";
import { LocalExecutionBackend } from "../execution/backend.js";
import type { FanoutOptions } from "../engine/fanout.js";
import { executeToolCall } from "../tools/substrate.js";
import type { CapabilityName, Config } from "../types.js";
import { appendBatchOutput, readBatchInput } from "./jsonl.js";
import { buildBatchPlan, loadResumeIndex, type BatchPlanEntry } from "./resume.js";
import { DEFAULT_BATCH_LIMIT, type BatchInputRecord, type BatchOutputRecord } from "./types.js";

/** Executes one validated batch input record into an output record. */
export interface BatchExecutor {
  execute(record: BatchInputRecord, config: Config): Promise<BatchOutputRecord>;
}

export interface BatchRunOptions {
  /** Input JSONL path. */
  input: string;
  /** Output JSONL path (append-only; resumed from existing content). */
  output: string;
  /** Maximum number of items executing at once. */
  concurrency: number;
  /** Retry records that errored in a prior run. */
  retryErrors: boolean;
  /** Config file path, threaded to the backend / tool substrate. */
  configPath?: string;
  /** Report the planned records without any provider calls or writes. */
  dryRun?: boolean;
  /** Test seam: replaces the default LocalExecutionBackend executor. */
  executor?: BatchExecutor;
}

/** JSON-safe projection of one plan entry for dry-run reporting. */
export interface BatchPlanReportEntry {
  id: string;
  capability?: CapabilityName;
  tool?: string;
  action: "execute" | "skip" | "conflict";
  reason?: string;
}

export interface BatchRunSummary {
  dry_run: boolean;
  input: string;
  output: string;
  concurrency: number;
  retry_errors: boolean;
  total: number;
  /** Plan entries with action "execute". */
  to_execute: number;
  /** Plan entries with action "skip" (resume or duplicate skips). */
  skipped: number;
  /** Plan entries with action "conflict" (duplicate/conflict error records). */
  conflicts: number;
  /** Real runs only. */
  executed?: number;
  succeeded?: number;
  failed?: number;
  /** Dry runs only: the planned records. */
  records?: BatchPlanReportEntry[];
}

/**
 * Dependency-free promise pool: run `fn` over `items` with at most
 * `concurrency` in-flight at once. Side effects inside `fn` (e.g. appends)
 * happen in completion order, not input order.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.floor(concurrency));
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await fn(items[index]);
    }
  });
  await Promise.all(workers);
}

/** Default executor: same backend/tool substrate as the standalone commands. */
export class LocalBatchExecutor implements BatchExecutor {
  private readonly backend: LocalExecutionBackend;

  constructor(configPath?: string) {
    this.backend = new LocalExecutionBackend(configPath);
  }

  async execute(record: BatchInputRecord, config: Config): Promise<BatchOutputRecord> {
    const base = {
      id: record.id,
      ...(record.capability ? { capability: record.capability } : {}),
      ...(record.tool ? { tool: record.tool } : {}),
    };
    try {
      if (record.capability === "search") {
        const result = await this.backend.search(record.query!, {
          ...this.fanoutOptions(record),
          rerankStrategy: "rrf",
        });
        this.warn(result.warnings);
        return {
          ...base,
          status: "success",
          result: {
            results: result.results,
            providers_used: result.providersUsed,
            ...(Object.keys(result.errors).length > 0 ? { errors: result.errors } : {}),
          },
          error: null,
        };
      }
      if (record.capability === "extract") {
        const result = await this.backend.extract(record.url!, this.fanoutOptions(record));
        this.warn(result.warnings);
        return {
          ...base,
          status: "success",
          result: {
            result: result.result,
            provider: result.provider,
            ...(result.errors && Object.keys(result.errors).length > 0
              ? { errors: result.errors }
              : {}),
          },
          error: null,
        };
      }
      if (record.capability === "crawl") {
        const result = await this.backend.crawl(record.url!, this.fanoutOptions(record));
        this.warn(result.warnings);
        return {
          ...base,
          status: "success",
          result: {
            results: result.results,
            provider: result.provider,
            ...(result.errors && Object.keys(result.errors).length > 0
              ? { errors: result.errors }
              : {}),
          },
          error: null,
        };
      }
      // Provider-tool record.
      const [provider, tool] = record.tool!.split(".");
      const result = await executeToolCall(provider, tool, record.input ?? {}, config, {
        noCache: record.noCache,
      });
      for (const warning of result.meta.warnings) {
        if (warning.includes("not recorded in history") || warning.includes("--freshness ignored")) {
          console.error(`Warning: ${warning}`);
        }
      }
      if (result.ok) {
        return { ...base, status: "success", result, error: null };
      }
      return {
        ...base,
        status: "error",
        result: null,
        error: {
          ...(result.error?.code ? { code: result.error.code } : {}),
          message: result.error?.message ?? "Tool call failed",
        },
      };
    } catch (error) {
      // The backend throws when every provider for a capability fails; a
      // failed item becomes an error record and never aborts sibling items.
      return {
        ...base,
        status: "error",
        result: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private fanoutOptions(record: BatchInputRecord): FanoutOptions {
    return {
      limit: record.limit ?? DEFAULT_BATCH_LIMIT,
      providers: record.providers,
      singleProvider: record.singleProvider,
      noCache: record.noCache,
    };
  }

  private warn(warnings: string[] | undefined): void {
    for (const warning of warnings ?? []) {
      console.error(`Warning: ${warning}`);
    }
  }
}

/**
 * Run one batch: read + validate input, plan against the output file's prior
 * outcomes, then execute with bounded concurrency, appending each record to
 * the output JSONL as it completes. Conflicts are deterministic from the input
 * alone and appended before execution starts. No item failure aborts the run.
 */
export async function runBatch(options: BatchRunOptions): Promise<BatchRunSummary> {
  const records = await readBatchInput(options.input);
  const resumeIndex = await loadResumeIndex(options.output);
  const plan = buildBatchPlan(records, resumeIndex, { retryErrors: options.retryErrors });
  const dryRun = options.dryRun === true;

  const report = (entry: BatchPlanEntry): BatchPlanReportEntry => ({
    id: entry.record.id,
    ...(entry.record.capability ? { capability: entry.record.capability } : {}),
    ...(entry.record.tool ? { tool: entry.record.tool } : {}),
    action: entry.action,
    ...(entry.reason ? { reason: entry.reason } : {}),
  });

  const summary: BatchRunSummary = {
    dry_run: dryRun,
    input: options.input,
    output: options.output,
    concurrency: options.concurrency,
    retry_errors: options.retryErrors,
    total: plan.length,
    to_execute: plan.filter((e) => e.action === "execute").length,
    skipped: plan.filter((e) => e.action === "skip").length,
    conflicts: plan.filter((e) => e.action === "conflict").length,
  };

  if (dryRun) {
    summary.records = plan.map(report);
    return summary;
  }

  const config = loadConfig(options.configPath);
  const executor = options.executor ?? new LocalBatchExecutor(options.configPath);

  // Conflict records are determined by the input alone: append them before
  // execution starts, in plan order.
  for (const entry of plan) {
    if (entry.action === "conflict" && entry.conflict) {
      await appendBatchOutput(options.output, entry.conflict);
    }
  }

  let executed = 0;
  let succeeded = 0;
  let failed = 0;
  await runWithConcurrency(
    plan.filter((e) => e.action === "execute"),
    options.concurrency,
    async (entry) => {
      const outputRecord = await safeExecute(executor, entry.record, config);
      await appendBatchOutput(options.output, outputRecord);
      executed += 1;
      if (outputRecord.status === "success") succeeded += 1;
      else failed += 1;
    }
  );

  summary.executed = executed;
  summary.succeeded = succeeded;
  summary.failed = failed;
  return summary;
}

/** Belt-and-braces: an unexpected executor throw becomes an error record. */
async function safeExecute(
  executor: BatchExecutor,
  record: BatchInputRecord,
  config: Config
): Promise<BatchOutputRecord> {
  try {
    return await executor.execute(record, config);
  } catch (error) {
    return {
      id: record.id,
      ...(record.capability ? { capability: record.capability } : {}),
      ...(record.tool ? { tool: record.tool } : {}),
      status: "error",
      result: null,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}
