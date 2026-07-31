/**
 * Tunnel ownership identity for the tunnel engine reclaim / XOR persistence path.
 *
 * Distinct from the business-facing
 * {@link import("../context/tunnel-context.interface.js").TunnelContext}.
 * The Context Engine maps into this shape at the tunnel boundary only.
 */
export type TunnelOwnershipKind = "anonymous" | "workspace";

export interface TunnelOwnership {
  readonly kind: TunnelOwnershipKind;
  /** Anonymous session id or workspace id, depending on {@link kind}. */
  readonly id: string;
}

/**
 * @deprecated Use {@link TunnelOwnership}. Kept as an alias for tunnel-engine BC.
 */
export type TunnelContext = TunnelOwnership;

/**
 * @deprecated Use {@link TunnelOwnershipKind}.
 */
export type TunnelContextKind = TunnelOwnershipKind;

/**
 * Builds anonymous tunnel ownership.
 */
export function createAnonymousTunnelContext(sessionId: string): TunnelOwnership {
  const id = sessionId.trim();
  if (id.length === 0) {
    throw new Error("Anonymous tunnel context requires a non-empty session id.");
  }
  return { kind: "anonymous", id };
}

/**
 * Builds workspace tunnel ownership.
 */
export function createWorkspaceTunnelContext(workspaceId: string): TunnelOwnership {
  const id = workspaceId.trim();
  if (id.length === 0) {
    throw new Error("Workspace tunnel context requires a non-empty workspace id.");
  }
  return { kind: "workspace", id };
}

/**
 * Workspace id when ownership is workspace-scoped; otherwise `undefined`.
 */
export function contextWorkspaceId(ownership: TunnelOwnership): string | undefined {
  return ownership.kind === "workspace" ? ownership.id : undefined;
}

/**
 * Anonymous session id when ownership is anonymous; otherwise `undefined`.
 */
export function contextAnonymousSessionId(ownership: TunnelOwnership): string | undefined {
  return ownership.kind === "anonymous" ? ownership.id : undefined;
}

/**
 * True when both ownership refs refer to the same logical owner.
 */
export function tunnelContextsEqual(a: TunnelOwnership, b: TunnelOwnership): boolean {
  return a.kind === b.kind && a.id === b.id;
}
