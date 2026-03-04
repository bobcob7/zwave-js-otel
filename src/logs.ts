import { SeverityNumber } from "@opentelemetry/api-logs";
import type { Logger } from "@opentelemetry/api-logs";
import type { ZwaveClient, ZUINode, ZUIValueId } from "./types.js";
import { EventSource } from "./types.js";

export interface LogsCleanup {
  destroy(): void;
}

export function createLogs(
  logger: Logger,
  zwave: ZwaveClient,
): LogsCleanup {
  function nodeLabel(node: ZUINode): string {
    return node.name ? `${node.id} (${node.name})` : String(node.id);
  }

  const onNodeStatus = (node: ZUINode) => {
    try {
      const status = node.status;
      const label = nodeLabel(node);
      const attrs = { "zwave.node.id": node.id, "zwave.node.status": status };
      switch (status) {
        case "Dead":
        case "dead":
          logger.emit({
            severityNumber: SeverityNumber.ERROR,
            severityText: "ERROR",
            body: `Node ${label} is dead`,
            attributes: attrs,
          });
          break;
        case "Alive":
        case "alive":
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: "INFO",
            body: `Node ${label} is alive`,
            attributes: attrs,
          });
          break;
        case "Asleep":
        case "asleep":
        case "Awake":
        case "awake":
          logger.emit({
            severityNumber: SeverityNumber.DEBUG,
            severityText: "DEBUG",
            body: `Node ${label} is ${status.toLowerCase()}`,
            attributes: attrs,
          });
          break;
      }
    } catch {
      // ignore
    }
  };

  const onDriverStatus = (ready: boolean) => {
    try {
      if (ready) {
        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: "INFO",
          body: "Z-Wave driver ready",
        });
      } else {
        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: "ERROR",
          body: "Z-Wave driver error",
        });
      }
    } catch {
      // ignore
    }
  };

  const onNodeRemoved = (node: Partial<ZUINode>) => {
    try {
      logger.emit({
        severityNumber: SeverityNumber.WARN,
        severityText: "WARN",
        body: `Node ${node.id ?? "unknown"} removed`,
        attributes: node.id != null ? { "zwave.node.id": node.id } : undefined,
      });
    } catch {
      // ignore
    }
  };

  const onNotification = (node: ZUINode, _valueId: ZUIValueId) => {
    try {
      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: "INFO",
        body: `Notification from node ${nodeLabel(node)}`,
        attributes: { "zwave.node.id": node.id },
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
      if (source === EventSource.NODE) {
        const node = args[0] as ZUINode | undefined;
        if (!node) return;
        switch (eventName) {
          case "node added":
            logger.emit({
              severityNumber: SeverityNumber.INFO,
              severityText: "INFO",
              body: `Node ${node.id} added`,
              attributes: { "zwave.node.id": node.id },
            });
            break;
          case "interview failed":
            logger.emit({
              severityNumber: SeverityNumber.ERROR,
              severityText: "ERROR",
              body: `Node ${node.id} interview failed`,
              attributes: { "zwave.node.id": node.id },
            });
            break;
        }
      }
    } catch {
      // ignore
    }
  };

  zwave.on("nodeStatus", onNodeStatus);
  zwave.on("driverStatus", onDriverStatus);
  zwave.on("nodeRemoved", onNodeRemoved);
  zwave.on("notification", onNotification);
  zwave.on("event", onEvent);

  return {
    destroy() {
      zwave.removeListener("nodeStatus", onNodeStatus);
      zwave.removeListener("driverStatus", onDriverStatus);
      zwave.removeListener("nodeRemoved", onNodeRemoved);
      zwave.removeListener("notification", onNotification);
      zwave.removeListener("event", onEvent);
    },
  };
}
