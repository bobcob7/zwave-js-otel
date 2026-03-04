import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import type { Meter } from "@opentelemetry/api";
import type { Tracer } from "@opentelemetry/api";
import type { Logger } from "@opentelemetry/api-logs";
import type { OtelConfig } from "./config.js";

export interface Providers {
  readonly meter: Meter;
  readonly tracer: Tracer;
  readonly logger: Logger;
  shutdown(): Promise<void>;
}

export function createProviders(config: OtelConfig): Providers {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: config.serviceName ?? "zwave-js-ui",
    [ATTR_SERVICE_VERSION]: "0.1.0",
  });

  const exporterOpts = {
    url: config.endpoint ? `${config.endpoint}/v1/metrics` : undefined,
    headers: config.headers,
  };

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(exporterOpts),
        exportIntervalMillis: config.metricExportIntervalMs,
      }),
    ],
  });

  const traceExporterOpts = {
    url: config.endpoint ? `${config.endpoint}/v1/traces` : undefined,
    headers: config.headers,
  };
  const tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(new OTLPTraceExporter(traceExporterOpts))],
  });

  const logExporterOpts = {
    url: config.endpoint ? `${config.endpoint}/v1/logs` : undefined,
    headers: config.headers,
  };
  const loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(
    new SimpleLogRecordProcessor(new OTLPLogExporter(logExporterOpts)),
  );

  const meter = meterProvider.getMeter("zwave-js-otel");
  const tracer = tracerProvider.getTracer("zwave-js-otel");
  const logger = loggerProvider.getLogger("zwave-js-otel");

  return {
    meter,
    tracer,
    logger,
    async shutdown() {
      const timeout = (p: Promise<void>) =>
        Promise.race([
          p,
          new Promise<void>((_resolve, reject) =>
            setTimeout(() => reject(new Error("shutdown timeout")), 5000),
          ),
        ]);
      await Promise.allSettled([
        timeout(meterProvider.shutdown()),
        timeout(tracerProvider.shutdown()),
        timeout(loggerProvider.shutdown()),
      ]);
    },
  };
}
