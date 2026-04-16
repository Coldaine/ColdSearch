import assert from "node:assert/strict";

export function installFetchMock(handlers) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init.method || "GET").toUpperCase();
    const key = `${method} ${url}`;

    const handler = handlers[key] || handlers[url] || handlers[method] || handlers["*"];
    assert.ok(handler, `No fetch mock handler for ${key}`);

    const res = await handler({ url, method, init });
    return res;
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function textResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain", ...headers },
  });
}

export function rawResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

