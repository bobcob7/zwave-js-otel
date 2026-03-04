import type { PluginContext, ZwaveClient, ModuleLogger } from "./types.js";
import { loadConfig } from "./config.js";
import { createProviders, type Providers } from "./providers.js";
import { createMetrics, type MetricsCleanup } from "./metrics.js";
import { createTraces, type TracesCleanup } from "./traces.js";
import { createLogs, type LogsCleanup } from "./logs.js";

class ZwaveOtelPlugin {
  zwave: ZwaveClient;
  mqtt: unknown;
  app: unknown;
  logger: ModuleLogger;
  name = "";

  private providers: Providers | undefined;
  private metricsCleanup: MetricsCleanup | undefined;
  private tracesCleanup: TracesCleanup | undefined;
  private logsCleanup: LogsCleanup | undefined;

  constructor(context: PluginContext) {
    this.zwave = context.zwave;
    this.mqtt = context.mqtt;
    this.app = context.app;
    this.logger = context.logger;
    try {
      const config = loadConfig();
      this.logger.info("zwave-js-otel config: %o", config);
      const providers = createProviders(config);
      this.providers = providers;
      this.metricsCleanup = createMetrics(providers.meter, this.zwave);
      this.tracesCleanup = createTraces(providers.tracer, this.zwave);
      this.logsCleanup = createLogs(providers.logger, this.zwave);
      this.logger.info("zwave-js-otel plugin initialized");
    } catch (err) {
      this.logger.error(
        "zwave-js-otel plugin failed to initialize: %s",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async destroy(): Promise<void> {
    try {
      this.metricsCleanup?.destroy();
      this.tracesCleanup?.destroy();
      this.logsCleanup?.destroy();
      await this.providers?.shutdown();
      this.logger.info("zwave-js-otel plugin destroyed");
    } catch (err) {
      this.logger.error(
        "zwave-js-otel plugin failed to destroy cleanly: %s",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

// zwave-js-ui expects a default export
export default ZwaveOtelPlugin;
