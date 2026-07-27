import type { HttpForwardingMessage } from "./http-forwarding.js";
import type { ControlPlaneMessage } from "./protocol.js";

/**
 * Discriminated union of every Badger protocol message.
 *
 * Includes tunnel control-plane messages and HTTP forwarding data-plane messages.
 */
export type ProtocolMessage = ControlPlaneMessage | HttpForwardingMessage;
