import { execFileSync } from "node:child_process";
import type { KeyPool } from "../types.js";
import { safeKeyRef } from "../logging/usage.js";

export interface KeyResult {
  value: string;
  ref: string;
}

const PROVIDER_DEFAULT_DOPPLER_SECRETS: Record<string, string> = {
  tavily: "TAVILY_API_KEY",
  exa: "EXA_API_KEY",
  firecrawl: "FIRECRAWL_API_KEY",
  brave: "BRAVE_API_KEY",
  serper: "SERPER_API_KEY",
};

export class KeyPoolManager {
  private pools: Map<string, KeyPool> = new Map();
  private indices: Map<string, number> = new Map();

  register(provider: string, pool: KeyPool): void {
    this.pools.set(provider, pool);
    this.indices.set(provider, 0);
  }

  async getNextKey(provider: string): Promise<string> {
    const result = await this.getNextKeyWithRef(provider);
    return result.value;
  }

  async getNextKeyWithRef(provider: string): Promise<KeyResult> {
    const pool = this.pools.get(provider);
    if (!pool) {
      throw new Error(`No key pool registered for provider: ${provider}`);
    }

    const refs = this.getEffectiveKeyRefs(provider, pool);
    if (!refs.length) {
      throw new Error(`Key pool for ${provider} is empty and no default secret name is available`);
    }

    const strategy = pool.strategy || "round-robin";
    let keyIndex: number;

    if (strategy === "random") {
      keyIndex = Math.floor(Math.random() * refs.length);
    } else {
      const currentIndex = this.indices.get(provider) || 0;
      keyIndex = currentIndex % refs.length;
      const nextIndex = (currentIndex + 1) % refs.length;
      this.indices.set(provider, nextIndex);
    }

    const keyRef = refs[keyIndex];
    const value = await this.resolveKeyRef(keyRef);
    return { value, ref: safeKeyRef(keyRef, provider) };
  }

  private getEffectiveKeyRefs(provider: string, pool: KeyPool): string[] {
    if (Array.isArray(pool.keys) && pool.keys.length > 0) {
      return pool.keys;
    }

    if (typeof pool.defaultSecretName === "string") {
      const trimmed = pool.defaultSecretName.trim();
      if (trimmed.length === 0) return [];
      return [`doppler:${trimmed}`];
    }

    const providerDefault = PROVIDER_DEFAULT_DOPPLER_SECRETS[provider];
    if (providerDefault) {
      return [`doppler:${providerDefault}`];
    }

    return [];
  }

  private async resolveKeyRef(keyRef: string): Promise<string> {
    if (keyRef.startsWith("env:")) {
      const varName = keyRef.slice(4);
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Environment variable ${varName} is not set`);
      }
      return value;
    }

    if (keyRef.startsWith("doppler:")) {
      const secretName = keyRef.slice(8).trim();
      if (!secretName) {
        throw new Error("Invalid Doppler secret reference: missing secret name");
      }
      return this.resolveDopplerSecret(secretName);
    }

    return keyRef;
  }

  private async resolveDopplerSecret(secretName: string): Promise<string> {
    try {
      const value = execFileSync("doppler", ["secrets", "get", secretName, "--plain"], {
        encoding: "utf8",
        timeout: 10000,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();

      if (!value) {
        throw new Error(`Doppler secret "${secretName}" resolved to empty value`);
      }

      return value;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        throw new Error("Doppler CLI not found on PATH. Install it from https://docs.doppler.com/docs/cli");
      }
      throw new Error(
        `Failed to resolve Doppler secret "${secretName}". Ensure Doppler is authenticated for this process.`
      );
    }
  }

  getProviders(): string[] {
    return Array.from(this.pools.keys());
  }

  hasKeys(provider: string): boolean {
    const pool = this.pools.get(provider);
    return !!pool && this.getEffectiveKeyRefs(provider, pool).length > 0;
  }

  async getNextKeyOrEmpty(provider: string): Promise<string> {
    if (!this.hasKeys(provider)) {
      return "";
    }
    return this.getNextKey(provider);
  }

  async getNextKeyWithRefOrEmpty(provider: string): Promise<KeyResult> {
    if (!this.hasKeys(provider)) {
      return { value: "", ref: `${provider}:keyless` };
    }
    return this.getNextKeyWithRef(provider);
  }
}

export function createKeyPoolManager(): KeyPoolManager {
  return new KeyPoolManager();
}

export const keyPoolManager = new KeyPoolManager();
