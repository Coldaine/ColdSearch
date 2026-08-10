import fs from "node:fs";
import {
  DUPLICATE_ID_CONFLICT,
  isConflictError,
  type BatchInputRecord,
  type BatchOutputRecord,
} from "./types.js";

/** Maps batch `id` -> the output records already present in the output file. */
export type ResumeIndex = Map<string, BatchOutputRecord[]>;

/** Per-record run actions in batch plan order. */
export type BatchPlanAction = "execute" | "skip" | "conflict";

export interface BatchPlanEntry {
  record: BatchInputRecord;
  action: BatchPlanAction;
  /** For `skip`: stable machine reason. */
  reason?: "resume-success" | "resume-error" | "resume-conflict" | "duplicate-identical";
  /** For `conflict`: the output record to append (never executed, never retried). */
  conflict?: BatchOutputRecord;
}

/**
 * Load the resume index from an existing output file. Malformed or partial
 * trailing lines (an interrupted run's last write) are ignored — they carry no
 * resumable outcome. A missing file yields an empty index.
 */
export async function loadResumeIndex(outputPath: string): Promise<ResumeIndex> {
  const index: ResumeIndex = new Map();
  let content: string;
  try {
    content = await fs.promises.readFile(outputPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return index;
    throw new Error(
      `Cannot read batch output file ${outputPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record: BatchOutputRecord;
    try {
      record = JSON.parse(line) as BatchOutputRecord;
    } catch {
      continue; // partial line from an interrupted write; nothing to resume
    }
    if (typeof record?.id !== "string" || record.id === "") continue;
    const records = index.get(record.id) ?? [];
    records.push(record);
    index.set(record.id, records);
  }
  return index;
}

/** Key-order-stable serialization of a record (minus its `id`) for duplicate comparison. */
function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Canonical form of a record's input (id excluded) for duplicate detection. */
export function canonicalizeRecord(record: BatchInputRecord): string {
  const { id: _id, ...rest } = record;
  return stableSerialize(rest);
}

/** Output record marking a repeated `id` with different input. */
export function conflictRecord(record: BatchInputRecord): BatchOutputRecord {
  return {
    id: record.id,
    ...(record.capability ? { capability: record.capability } : {}),
    ...(record.tool ? { tool: record.tool } : {}),
    status: "error",
    result: null,
    error: {
      code: DUPLICATE_ID_CONFLICT,
      message: `Duplicate id '${record.id}' with different input; the first occurrence wins and this record was not executed.`,
    },
  };
}

export interface BuildPlanOptions {
  retryErrors: boolean;
}

/**
 * Build the deterministic execution plan for one batch run.
 *
 * Resume (from the output file, by stable `id`):
 * - Existing success records are skipped.
 * - Existing retriable error records are retried only with `retryErrors`.
 * - Existing duplicate/conflict records are never retried.
 *
 * Duplicate ids within the input are resolved by the FIRST occurrence:
 * - Later identical records are skipped without output.
 * - Later records with different input become visible conflict error records
 *   (never executed, never retried) so reruns stay deterministic.
 */
export function buildBatchPlan(
  records: BatchInputRecord[],
  resumeIndex: ResumeIndex,
  options: BuildPlanOptions
): BatchPlanEntry[] {
  const plan: BatchPlanEntry[] = [];
  const seen = new Map<string, string>(); // id -> canonical input of first occurrence

  for (const record of records) {
    const existing = resumeIndex.get(record.id) ?? [];
    const hasSuccess = existing.some((r) => r.status === "success");
    const hasRetriableError = existing.some(
      (r) => r.status === "error" && !isConflictError(r.error)
    );
    const hasConflict = existing.some(
      (r) => r.status === "error" && isConflictError(r.error)
    );

    const firstInput = seen.get(record.id);
    if (firstInput === undefined) {
      // First occurrence: the primary record for this id.
      seen.set(record.id, canonicalizeRecord(record));
      if (hasSuccess) {
        plan.push({ record, action: "skip", reason: "resume-success" });
      } else if (hasRetriableError && !options.retryErrors) {
        plan.push({ record, action: "skip", reason: "resume-error" });
      } else {
        // Execute, including when the id only has a conflict record so far
        // (the primary never produced its own outcome) and retriable-error
        // retries when --retry-errors is set.
        plan.push({ record, action: "execute" });
      }
      continue;
    }

    // Later occurrence of an existing id: pure duplicate handling.
    if (canonicalizeRecord(record) === firstInput) {
      plan.push({ record, action: "skip", reason: "duplicate-identical" });
    } else if (hasConflict) {
      // A conflict for this id is already visible in the output; do not
      // re-emit it, keeping reruns append-once.
      plan.push({ record, action: "skip", reason: "resume-conflict" });
    } else {
      plan.push({ record, action: "conflict", conflict: conflictRecord(record) });
    }
  }

  return plan;
}
