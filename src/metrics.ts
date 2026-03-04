import type { Meter, Counter, BatchObservableResult } from "@opentelemetry/api";
import type {
  ZwaveClient,
  ZUIValueId,
  ZUINode,
  ControllerStatistics,
} from "./types.js";
import { EventSource } from "./types.js";

export interface MetricsCleanup {
  destroy(): void;
}

export function createMetrics(
  meter: Meter,
  zwave: ZwaveClient,
): MetricsCleanup {
  let cachedControllerStats: ControllerStatistics | undefined;

  // --- Gauges ---

  const nodeCount = meter.createObservableGauge("zwave.node.count", {
    description: "Number of Z-Wave nodes by status",
  });

  nodeCount.addCallback((result) => {
    try {
      const counts = new Map<string, number>();
      for (const [, node] of zwave.nodes) {
        const status = node.status ?? "unknown";
        counts.set(status, (counts.get(status) ?? 0) + 1);
      }
      for (const [status, count] of counts) {
        result.observe(count, { status });
      }
    } catch {
      // ignore — OTEL must not crash the host
    }
  });

  // --- Counters ---

  const valueChanges: Counter = meter.createCounter("zwave.value.changes", {
    description: "Number of Z-Wave value changes",
  });

  // --- Observable Counters (controller stats) ---

  const messagesTx = meter.createObservableCounter(
    "zwave.controller.messages.tx",
    { description: "Total messages transmitted by the controller" },
  );
  const messagesRx = meter.createObservableCounter(
    "zwave.controller.messages.rx",
    { description: "Total messages received by the controller" },
  );
  const messagesDropped = meter.createObservableCounter(
    "zwave.controller.messages.dropped",
    { description: "Total messages dropped by the controller" },
  );
  const timeouts = meter.createObservableCounter(
    "zwave.controller.timeouts",
    { description: "Total controller timeouts" },
  );
  const nak = meter.createObservableCounter("zwave.controller.nak", {
    description: "Total NAK responses from the controller",
  });

  meter.addBatchObservableCallback(
    (result: BatchObservableResult) => {
      if (!cachedControllerStats) return;
      const s = cachedControllerStats;
      result.observe(messagesTx, s.messagesTX);
      result.observe(messagesRx, s.messagesRX);
      result.observe(messagesDropped, s.messagesDroppedTX, { direction: "tx" });
      result.observe(messagesDropped, s.messagesDroppedRX, { direction: "rx" });
      result.observe(timeouts, s.timeoutACK, { type: "ack" });
      result.observe(timeouts, s.timeoutResponse, { type: "response" });
      result.observe(timeouts, s.timeoutCallback, { type: "callback" });
      result.observe(nak, s.NAK);
    },
    [messagesTx, messagesRx, messagesDropped, timeouts, nak],
  );

  // --- Event handlers ---

  const onValueChanged = (valueId: ZUIValueId, _node: ZUINode) => {
    try {
      valueChanges.add(1, {
        command_class: valueId.commandClassName ?? String(valueId.commandClass),
      });
    } catch {
      // ignore
    }
  };

  const onEvent = (
    source: EventSource,
    eventName: string,
    ...args: unknown[]
  ) => {
    try {
      if (source === EventSource.CONTROLLER && eventName === "statistics updated") {
        cachedControllerStats = args[0] as ControllerStatistics;
      }
    } catch {
      // ignore
    }
  };

  zwave.on("valueChanged", onValueChanged);
  zwave.on("event", onEvent);

  return {
    destroy() {
      zwave.removeListener("valueChanged", onValueChanged);
      zwave.removeListener("event", onEvent);
    },
  };
}
