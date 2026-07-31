/**
 * Tunnel details rendered to the user.
 */
export interface TunnelPresentation {
  /** Public URL assigned by the server. */
  readonly publicUrl: string;
  /** Local TCP port being exposed. */
  readonly port: number;
  /** `true` when a previous tunnel id was reclaimed after a reconnect. */
  readonly restored: boolean;
  /** Optional workspace display name (presentation only). */
  readonly workspaceLabel?: string;
  /** Tunnel ownership mode for the banner. */
  readonly mode?: "workspace" | "anonymous";
}

/**
 * User-facing view of a Badger session.
 *
 * Keeps presentation concerns (spinners, color, QR codes, clipboard) out of the
 * session service, which only reports lifecycle events.
 */
export interface SessionPresenter {
  /**
   * Reports that a session is starting for a local port.
   *
   * @param port - Local TCP port being exposed.
   */
  starting(port: number): void;

  /**
   * Reports a completed handshake with the server.
   */
  connected(): void;

  /**
   * Renders the banner for a newly created tunnel.
   *
   * @param tunnel - Tunnel details to display.
   */
  tunnelReady(tunnel: TunnelPresentation): Promise<void>;

  /**
   * Reports that the live connection dropped and a retry is pending.
   */
  connectionLost(): void;

  /**
   * Reports a failed reconnect attempt before the next retry.
   *
   * @param error - Reason the attempt failed.
   */
  reconnectFailed(error: Error): void;

  /**
   * Renders the banner after a successful reconnect.
   *
   * @param tunnel - Tunnel details active on the new connection.
   */
  reconnected(tunnel: TunnelPresentation): Promise<void>;

  /**
   * Reports that the session could not be established.
   *
   * @param message - Human-readable failure description.
   */
  failed(message: string): void;

  /**
   * Reports that a shutdown signal was received.
   */
  shuttingDown(): void;

  /**
   * Reports that the session closed cleanly.
   */
  stopped(): void;
}
