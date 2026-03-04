import { SpanStatusCode, type Span, type Tracer } from "@opentelemetry/api";
import type { ZwaveClient, ZUINode } from "./types.js";
import { EventSource } from "./types.js";

export interface TracesCleanup {
  destroy(): void;
}

export function createTraces(
  tracer: Tracer,
  zwave: ZwaveClient,
): TracesCleanup {
  let inclusionSpan: Span | undefined;
  const interviewSpans = new Map<number, Span>();

  const onEvent = (
    source: EventSource,
    eventName: string,
    ...args: unknown[]
  ) => {
    try {
      if (source === EventSource.CONTROLLER) {
        handleControllerEvent(eventName);
      } else if (source === EventSource.NODE) {
        handleNodeEvent(eventName, args);
      }
    } catch {
      // ignore — OTEL must not crash the host
    }
  };

  function handleControllerEvent(eventName: string) {
    switch (eventName) {
      case "inclusion started":
        inclusionSpan?.end();
        inclusionSpan = tracer.startSpan("zwave.inclusion");
        break;
      case "exclusion started":
        inclusionSpan?.end();
        inclusionSpan = tracer.startSpan("zwave.exclusion");
        break;
      case "inclusion stopped":
      case "exclusion stopped":
        inclusionSpan?.setStatus({ code: SpanStatusCode.OK });
        inclusionSpan?.end();
        inclusionSpan = undefined;
        break;
      case "inclusion failed":
      case "exclusion failed":
        inclusionSpan?.setStatus({
          code: SpanStatusCode.ERROR,
          message: eventName,
        });
        inclusionSpan?.end();
        inclusionSpan = undefined;
        break;
    }
  }

  function handleNodeEvent(eventName: string, args: unknown[]) {
    const node = args[0] as ZUINode | undefined;
    if (!node) return;
    const nodeId = node.id;
    switch (eventName) {
      case "interview started": {
        const existing = interviewSpans.get(nodeId);
        existing?.end();
        const span = tracer.startSpan("zwave.node.interview", {
          attributes: { "zwave.node.id": nodeId },
        });
        interviewSpans.set(nodeId, span);
        break;
      }
      case "interview stage completed": {
        const span = interviewSpans.get(nodeId);
        span?.addEvent("stage_completed", {
          "zwave.node.interview_stage": node.interviewStage,
        });
        break;
      }
      case "interview completed": {
        const span = interviewSpans.get(nodeId);
        if (span) {
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          interviewSpans.delete(nodeId);
        }
        break;
      }
      case "interview failed": {
        const span = interviewSpans.get(nodeId);
        if (span) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "interview failed",
          });
          span.end();
          interviewSpans.delete(nodeId);
        }
        break;
      }
    }
  }

  zwave.on("event", onEvent);

  return {
    destroy() {
      zwave.removeListener("event", onEvent);
      inclusionSpan?.end();
      inclusionSpan = undefined;
      for (const [, span] of interviewSpans) {
        span.end();
      }
      interviewSpans.clear();
    },
  };
}
