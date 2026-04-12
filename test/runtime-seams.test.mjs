import test from "node:test";
import assert from "node:assert/strict";
import { FanoutEngine } from "../dist/engine/fanout.js";
import { SearXNGAdapter } from "../dist/adapters/searxng.js";

test("fanout rejects providers that do not implement requested capability", async () => {
  const engine = new FanoutEngine({
    capabilities: {
      search: {
        providers: ["jina"],
        strategy: "random",
      },
    },
    providers: {
      jina: {
        keyPool: {
          keys: [],
        },
      },
    },
  });

  await assert.rejects(
    engine.search("fusion", {
      limit: 5,
    }),
    /does not implement capability 'search'/
  );
});

test("searxng requires an explicit base url before searching", async () => {
  const adapter = new SearXNGAdapter();
  await assert.rejects(
    adapter.search("fusion", ""),
    /requires providers\.searxng\.options\.baseUrl/
  );
});
