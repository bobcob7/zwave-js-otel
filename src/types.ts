import type { EventEmitter } from "node:events";

export const enum EventSource {
  DRIVER = "driver",
  CONTROLLER = "controller",
  NODE = "node",
}

export interface ZUINode {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly interviewStage: string;
  readonly ready: boolean;
  readonly available: boolean;
  readonly failed: boolean;
}

export interface ZUIValueId {
  readonly id: string;
  readonly nodeId: number;
  readonly commandClass: number;
  readonly commandClassName: string;
  readonly endpoint: number;
  readonly property: string;
  readonly propertyKey?: string;
  readonly label?: string;
  readonly value?: unknown;
}

export interface ControllerStatistics {
  readonly messagesTX: number;
  readonly messagesRX: number;
  readonly messagesDroppedTX: number;
  readonly messagesDroppedRX: number;
  readonly timeoutACK: number;
  readonly timeoutResponse: number;
  readonly timeoutCallback: number;
  readonly NAK: number;
  readonly CAN: number;
}

export interface ZwaveClient extends EventEmitter {
  readonly nodes: Map<number, ZUINode>;
}

export interface ModuleLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface PluginContext {
  readonly zwave: ZwaveClient;
  readonly mqtt: unknown;
  readonly app: unknown;
  readonly logger: ModuleLogger;
}
