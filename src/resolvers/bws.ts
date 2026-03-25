import { BitwardenClient, ClientSettings, DeviceType, LogLevel } from "@bitwarden/sdk-napi";

export interface BWSSecretResolverOptions {
  /** BWS Access Token (or uses BWS_ACCESS_TOKEN env var) */
  accessToken?: string;
  /** Organization ID (optional - can be derived from token) */
  organizationId?: string;
}

/**
 * Bitwarden Secrets Manager resolver.
 * Retrieves secrets by name or ID from BWS.
 */
export class BWSSecretResolver {
  private client: BitwardenClient;
  private accessToken: string;
  private organizationId?: string;
  private initialized = false;
  private secretsCache?: Map<string, string>; // name -> id

  constructor(options: BWSSecretResolverOptions = {}) {
    this.accessToken = options.accessToken || process.env.BWS_ACCESS_TOKEN || "";
    this.organizationId = options.organizationId || process.env.BWS_ORGANIZATION_ID;

    if (!this.accessToken) {
      throw new Error(
        "BWS access token required. Set BWS_ACCESS_TOKEN env var or pass accessToken option."
      );
    }

    const settings: ClientSettings = {
      apiUrl: "https://api.bitwarden.com",
      identityUrl: "https://identity.bitwarden.com",
      userAgent: "usearch/0.2.0",
      deviceType: DeviceType.SDK,
    };

    this.client = new BitwardenClient(settings, LogLevel.Warn);
  }

  /** Initialize/authenticate the client */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.client.auth().loginAccessToken(this.accessToken, undefined);

    // Infer organization ID if not provided
    if (!this.organizationId) {
      this.organizationId = await this.inferOrganizationId();
    }

    this.initialized = true;
  }

  /** Get secret by ID (UUID) */
  async getById(secretId: string): Promise<string> {
    await this.init();

    const secret = await this.client.secrets().get(secretId);
    if (!secret) {
      throw new Error(`Secret ${secretId} not found in BWS`);
    }
    return secret.value;
  }

  /** Get secret by name (key) */
  async getByName(secretName: string): Promise<string> {
    await this.init();

    if (!this.organizationId) {
      throw new Error(
        "Organization ID required to search BWS by name. " +
        "Set BWS_ORGANIZATION_ID env var or pass organizationId option."
      );
    }

    // Use cache if available
    if (this.secretsCache?.has(secretName)) {
      const id = this.secretsCache.get(secretName)!;
      return this.getById(id);
    }

    // List and cache all secrets
    const secretsList = await this.client.secrets().list(this.organizationId);
    this.secretsCache = new Map();

    for (const s of secretsList.data) {
      this.secretsCache.set(s.key, s.id);
    }

    const id = this.secretsCache.get(secretName);
    if (!id) {
      throw new Error(`Secret "${secretName}" not found in BWS`);
    }

    return this.getById(id);
  }

  /** Resolve a secret reference (supports both name and ID) */
  async resolve(ref: string): Promise<string> {
    await this.init();

    // Check if ref is a UUID
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidPattern.test(ref)) {
      return this.getById(ref);
    } else {
      return this.getByName(ref);
    }
  }

  private async inferOrganizationId(): Promise<string | undefined> {
    // Note: We can't list projects without an org ID (chicken-and-egg)
    // User must provide org ID or we'll discover it from secret listing
    return undefined;
  }
}

/** Global BWS resolver instance */
let bwsResolver: BWSSecretResolver | null = null;

export async function resolveBWSSecret(ref: string): Promise<string> {
  if (!bwsResolver) {
    bwsResolver = new BWSSecretResolver();
  }
  return bwsResolver.resolve(ref);
}

/** Reset resolver (for testing) */
export function resetBWSResolver(): void {
  bwsResolver = null;
}
