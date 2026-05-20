/**
 * Registry ↔ Adapter Capability Drift Test
 *
 * Ensures that the capabilities declared in the provider registry
 * (src/providers.ts) match the capabilities declared on each adapter
 * class (src/adapters/*.ts). These two sources of truth can silently
 * drift, causing runtime validation to reject valid providers or
 * allow invalid ones.
 */

import { providerRegistry, listRegisteredProviders } from "../dist/providers.js";
import { BraveAdapter } from "../dist/adapters/brave.js";
import { ExaAdapter } from "../dist/adapters/exa.js";
import { FirecrawlAdapter } from "../dist/adapters/firecrawl.js";
import { JinaAdapter } from "../dist/adapters/jina.js";
import { SearXNGAdapter } from "../dist/adapters/searxng.js";
import { SerperAdapter } from "../dist/adapters/serper.js";
import { TavilyAdapter } from "../dist/adapters/tavily.js";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

const adapterByName = {
  brave: BraveAdapter,
  exa: ExaAdapter,
  firecrawl: FirecrawlAdapter,
  jina: JinaAdapter,
  searxng: SearXNGAdapter,
  serper: SerperAdapter,
  tavily: TavilyAdapter,
};

describe("registry ↔ adapter capability consistency", () => {
  for (const providerName of listRegisteredProviders()) {
    test(`${providerName}: registry capabilities match adapter capabilities`, () => {
      const registryCaps = providerRegistry[providerName].capabilities.sort().join(",");
      const AdapterClass = adapterByName[providerName];
      assert.ok(AdapterClass, `No adapter class found for provider '${providerName}'`);

      const instance = new AdapterClass();
      const adapterCaps = instance.capabilities.sort().join(",");

      assert.equal(
        adapterCaps,
        registryCaps,
        `Adapter '${providerName}' declares [${adapterCaps}] but registry declares [${registryCaps}]. ` +
        `These must stay in sync — pick one source of truth or add enforcement.`
      );
    });
  }

  test("every registered provider has a corresponding adapter class", () => {
    const registered = listRegisteredProviders().sort();
    const adapterNames = Object.keys(adapterByName).sort();
    assert.deepEqual(registered, adapterNames,
      `Registry providers [${registered}] and adapter map keys [${adapterNames}] must match`);
  });
});
