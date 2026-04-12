export interface RequestPolicy {
  label?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  allowNonIdempotentRetries?: boolean;
}

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 500;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export class HTTPRequestError extends Error {
  status?: number;
  body?: string;
  url: string;

  constructor(message: string, options: { url: string; status?: number; body?: string }) {
    super(message);
    this.name = "HTTPRequestError";
    this.url = options.url;
    this.status = options.status;
    this.body = options.body;
  }
}

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError("Sleep aborted"));
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(createAbortError("Sleep aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function shouldRetryStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

function shouldRetryError(error: unknown, externalAborted: boolean): boolean {
  if (error instanceof HTTPRequestError) {
    return error.status !== undefined && shouldRetryStatus(error.status);
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return !externalAborted;
    }

    return error.name === "TypeError";
  }

  return false;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export async function fetchWithPolicy(
  input: string | URL,
  init: RequestInit = {},
  policy: RequestPolicy = {}
): Promise<Response> {
  const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = (init.method || "GET").toUpperCase();
  const canRetry = ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"].includes(method) ||
    policy.allowNonIdempotentRetries === true;
  const retries = canRetry ? (policy.retries ?? DEFAULT_RETRIES) : 0;
  const retryDelayMs = policy.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const requestUrl = input.toString();
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = init.signal ?? undefined;

    const onAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeout);
        throw createAbortError(`Request aborted before start: ${requestUrl}`);
      }
      externalSignal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      if (attempt < retries && shouldRetryStatus(response.status)) {
        await response.body?.cancel();
        await sleep(retryDelayMs * (attempt + 1), externalSignal);
        continue;
      }

      const body = await safeReadText(response);
      throw new HTTPRequestError(
        `${policy.label || "Request"} failed with HTTP ${response.status}`,
        { url: requestUrl, status: response.status, body }
      );
    } catch (error) {
      lastError = error;
      const externalAborted = externalSignal?.aborted === true;

      if (attempt < retries && shouldRetryError(error, externalAborted)) {
        await sleep(retryDelayMs * (attempt + 1), externalSignal);
        continue;
      }

      if (error instanceof Error && error.name === "AbortError") {
        if (externalAborted) {
          throw createAbortError(`${policy.label || "Request"} was aborted by caller`);
        }

        throw new Error(`${policy.label || "Request"} timed out after ${timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onAbort);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed: ${requestUrl}`);
}

export async function fetchJson<T>(
  input: string | URL,
  init: RequestInit = {},
  policy: RequestPolicy = {}
): Promise<T> {
  const response = await fetchWithPolicy(input, init, policy);

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new Error(
      `${policy.label || "Request"} returned invalid JSON: ${(error as Error).message}`
    );
  }
}

export async function fetchText(
  input: string | URL,
  init: RequestInit = {},
  policy: RequestPolicy = {}
): Promise<string> {
  const response = await fetchWithPolicy(input, init, policy);
  return response.text();
}
