import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface OtelConfig {
  readonly endpoint?: string;
  readonly serviceName?: string;
  readonly headers?: Record<string, string>;
  readonly metricExportIntervalMs?: number;
}

const CONFIG_FILENAME = "otel.json";

function tryReadJson(path: string): OtelConfig | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as OtelConfig;
  } catch {
    return undefined;
  }
}

export function loadConfig(): OtelConfig {
  const pluginDir = dirname(fileURLToPath(import.meta.url));
  const storeDir = process.env["STORE_DIR"] ?? join(process.cwd(), "store");
  return (
    tryReadJson(join(pluginDir, CONFIG_FILENAME)) ??
    tryReadJson(join(storeDir, CONFIG_FILENAME)) ??
    {}
  );
}
