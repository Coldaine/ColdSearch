import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

export const APP_NAME = "coldsearch";
export const LEGACY_APP_NAME = "usearch";
export const APP_VERSION = packageJson.version;
export const APP_USER_AGENT = `${APP_NAME}/${APP_VERSION}`;
export const DEFAULT_CONFIG_DIR_NAME = APP_NAME;
export const LEGACY_CONFIG_DIR_NAME = LEGACY_APP_NAME;

export function formatVersionString(): string {
  return `${APP_NAME} v${APP_VERSION}`;
}
