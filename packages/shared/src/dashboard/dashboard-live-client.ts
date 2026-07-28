import { RECONNECT_INTERVAL_MS } from "../constants/reconnect.js";
import {
  DASHBOARD_WS_PATH,
  DashboardMessageType,
  type DashboardMessage,
} from "./dashboard-messages.js";
import { parseDashboardMessage } from "./map-dashboard-message.js";

/**
 * Builds the dashboard live WebSocket URL from an HTTP or WS server base.
 *
 * @param serverBaseUrl - `http(s)://` or `ws(s)://` origin (path ignored).
 * @returns WebSocket URL ending in {@link DASHBOARD_WS_PATH}.
 */
export function buildDashboardWebSocketUrl(serverBaseUrl: string): string {
  const url = new URL(serverBaseUrl);
  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error(`Unsupported server URL protocol: ${url.protocol}`);
  }

  url.pathname = DASHBOARD_WS_PATH;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * Options for {@link DashboardLiveClient}.
 */
export interface DashboardLiveClientOptions {
  /** WebSocket URL (`ws(s)://…/dashboard/ws`) or HTTP origin to convert. */
  readonly url: string;
  /** Delay between reconnect attempts (default {@link RECONNECT_INTERVAL_MS}). */
  readonly reconnectIntervalMs?: number;
  /** When `false`, the client does not reconnect after unexpected close. */
  readonly autoReconnect?: boolean;
  /** Injected WebSocket constructor (tests / browser / Node). */
  readonly WebSocketImpl?: typeof WebSocket;
  /** Called when the socket finishes opening. */
  readonly onOpen?: () => void;
  /** Called when the socket closes. */
  readonly onClose?: (info: { readonly intentional: boolean }) => void;
  /** Called just before a reconnect attempt is scheduled/started. */
  readonly onReconnecting?: () => void;
}

/**
 * Handler for inbound dashboard messages.
 */
export type DashboardMessageHandler = (message: DashboardMessage) => void;

/**
 * Browser/Node WebSocket client for `/dashboard/ws` with automatic reconnect.
 *
 * Replies to server `ping` with `pong`. Does not speak the CLI tunnel protocol.
 */
export class DashboardLiveClient {
  private readonly url: string;
  private readonly reconnectIntervalMs: number;
  private readonly autoReconnect: boolean;
  private readonly WebSocketImpl: typeof WebSocket;
  private readonly handlers = new Set<DashboardMessageHandler>();
  private readonly onOpen: (() => void) | undefined;
  private readonly onClose: ((info: { readonly intentional: boolean }) => void) | undefined;
  private readonly onReconnecting: (() => void) | undefined;

  private socket: WebSocket | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private intentionalClose = false;
  private opened = false;

  /**
   * @param options - Connection options.
   */
  constructor(options: DashboardLiveClientOptions) {
    this.url = normalizeDashboardUrl(options.url);
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? RECONNECT_INTERVAL_MS;
    this.autoReconnect = options.autoReconnect !== false;
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onReconnecting = options.onReconnecting;
  }

  /**
   * Registers a message handler.
   *
   * @param handler - Callback for each parsed dashboard message.
   * @returns Unsubscribe function.
   */
  subscribe(handler: DashboardMessageHandler): () => void {
    this.handlers.add(handler);
    return (): void => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Opens the WebSocket (idempotent when already open/connecting).
   */
  connect(): void {
    this.intentionalClose = false;
    if (
      this.socket !== undefined &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.clearReconnectTimer();
    const socket = new this.WebSocketImpl(this.url);
    this.socket = socket;
    this.opened = false;

    socket.addEventListener("open", () => {
      if (this.socket !== socket) {
        return;
      }
      this.opened = true;
      this.onOpen?.();
    });

    socket.addEventListener("message", (event) => {
      if (this.socket !== socket) {
        return;
      }
      this.handleRawMessage(event.data);
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket && this.socket !== undefined) {
        // A newer socket replaced this one; ignore the stale close.
        return;
      }
      this.socket = undefined;
      this.opened = false;
      this.onClose?.({ intentional: this.intentionalClose });
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      // `close` follows; reconnect is scheduled there.
    });
  }

  /**
   * Closes the socket and cancels automatic reconnect.
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    const socket = this.socket;
    this.socket = undefined;
    if (socket !== undefined && socket.readyState < WebSocket.CLOSING) {
      socket.close();
    }
  }

  /**
   * @returns `true` when the socket is open.
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN && this.opened;
  }

  private handleRawMessage(data: unknown): void {
    const raw = coerceToUtf8(data);
    if (raw === undefined) {
      return;
    }

    this.dispatchParsed(raw);
  }

  private dispatchParsed(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return;
    }

    const message = parseDashboardMessage(parsed);
    if (message === undefined) {
      return;
    }

    if (message.type === DashboardMessageType.Ping) {
      this.send({
        type: DashboardMessageType.Pong,
        occurredAt: Date.now(),
      });
    }

    for (const handler of [...this.handlers]) {
      handler(message);
    }
  }

  private send(message: DashboardMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || !this.autoReconnect) {
      return;
    }

    this.onReconnecting?.();
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectIntervalMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}

/**
 * Ensures the URL targets {@link DASHBOARD_WS_PATH}.
 *
 * @param url - Absolute WebSocket or HTTP URL.
 * @returns Normalized dashboard WebSocket URL.
 */
function normalizeDashboardUrl(url: string): string {
  if (url.includes(DASHBOARD_WS_PATH)) {
    const parsed = new URL(url);
    if (parsed.protocol === "http:") {
      parsed.protocol = "ws:";
    } else if (parsed.protocol === "https:") {
      parsed.protocol = "wss:";
    }
    return parsed.toString();
  }

  return buildDashboardWebSocketUrl(url);
}

/**
 * Coerces WebSocket message data to a UTF-8 string.
 *
 * @param data - Browser or Node message payload.
 * @returns Decoded text, or `undefined` when unsupported.
 */
function coerceToUtf8(data: unknown): string | undefined {
  if (typeof data === "string") {
    return data;
  }

  // Node Buffer (optional global) — avoid importing `node:buffer` so this
  // client stays safe for browser bundles.
  if (
    typeof Buffer !== "undefined" &&
    typeof Buffer.isBuffer === "function" &&
    Buffer.isBuffer(data)
  ) {
    return data.toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  return undefined;
}
