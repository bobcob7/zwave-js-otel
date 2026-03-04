import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface OtelConfig {
  readonly endpoint?: string;
  readonly serviceName?: string;
  readonly headers?: Record<string, string>;
  readonly metricExportIntervalMs?: number;
}

const CONFIG_FILENAME = "otel.json";

function resolveStoreDir(): string {
  return process.env["STORE_DIR"] ?? join(process.cwd(), "store");
}

export function loadConfig(): OtelConfig {
  const configPath = join(resolveStoreDir(), CONFIG_FILENAME);
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as OtelConfig;
  } catch {
    return {};
  }
}
