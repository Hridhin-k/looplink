/**
 * Lifecycle states for the CLI's connection to the LoopLink server.
 */
export enum ConnectionState {
  /** No socket exists, or the previous socket has fully closed. */
  Disconnected = "disconnected",
  /** A connection attempt is in flight. */
  Connecting = "connecting",
  /** The WebSocket handshake completed successfully. */
  Connected = "connected",
  /** An intentional close is in flight. */
  Disconnecting = "disconnecting",
  /** Waiting to retry after an unexpected disconnect. */
  Reconnecting = "reconnecting",
}
