import { ContextType } from "./context-type.js";
import type { TunnelContext } from "./tunnel-context.interface.js";
import {
  createAnonymousTunnelContext,
  createWorkspaceTunnelContext,
  type TunnelOwnership,
} from "../tunnel/tunnel-context.js";

/**
 * Maps a business {@link TunnelContext} to tunnel-engine ownership.
 *
 * Used only at the TunnelManager boundary so the tunnel engine stays unaware of
 * auth mechanisms while reclaim / XOR rows keep working.
 */
export function toTunnelOwnership(context: TunnelContext): TunnelOwnership {
  if (context.contextType === ContextType.Anonymous) {
    if (context.anonymousSessionId === null || context.anonymousSessionId.length === 0) {
      throw new Error("Anonymous TunnelContext requires anonymousSessionId.");
    }
    return createAnonymousTunnelContext(context.anonymousSessionId);
  }

  if (context.contextType === ContextType.Workspace) {
    if (context.workspaceId === null || context.workspaceId.length === 0) {
      throw new Error("Workspace TunnelContext requires workspaceId.");
    }
    return createWorkspaceTunnelContext(context.workspaceId);
  }

  throw new Error(`Unsupported context type for tunnel ownership: ${context.contextType}`);
}

/**
 * Account id for workspace-scoped ownership rows (absent for anonymous).
 */
export function ownershipAccountId(context: TunnelContext): string | undefined {
  const raw = context.metadata["accountId"];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}
