import type { Result } from "./result.js";
import { err, ok } from "../utils/result.js";
import {
  isHttpForwardingMessageType,
  parseHttpForwardingMessage,
} from "./parse-http-forwarding.js";
import type { ProtocolMessage } from "./protocol-message.js";
import {
  MessageType,
  type ConnectedMessage,
  type CreateTunnelMessage,
  type ErrorMessage,
  type PingMessage,
  type PongMessage,
  type TunnelCreatedMessage,
} from "./protocol.js";

/**
 * Parses a raw JSON string into a LoopLink {@link ProtocolMessage}.
 *
 * @param raw - JSON text received over the wire.
 * @returns A successful result with the typed message, or a failed result with
 *   a human-readable parse error.
 */
export function parseProtocolMessage(raw: string): Result<ProtocolMessage, string> {
  let value: unknown;

  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return err("Message is not valid JSON.");
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return err("Message must be a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const type = record["type"];

  if (typeof type !== "string") {
    return err('Message is missing a string "type" field.');
  }

  if (!isMessageType(type)) {
    return err(`Unknown message type "${type}".`);
  }

  if (isHttpForwardingMessageType(type)) {
    return parseHttpForwardingMessage(type, record);
  }

  switch (type) {
    case MessageType.Connected:
      return parseConnected(record);
    case MessageType.CreateTunnel:
      return parseCreateTunnel(record);
    case MessageType.TunnelCreated:
      return parseTunnelCreated(record);
    case MessageType.Error:
      return parseError(record);
    case MessageType.Ping:
      return parsePing(record);
    case MessageType.Pong:
      return parsePong(record);
    default:
      return err(`Unsupported message type "${type}".`);
  }
}

/**
 * Narrows an arbitrary string to {@link MessageType}.
 *
 * @param value - Candidate discriminator.
 * @returns `true` when `value` is a known message type.
 */
function isMessageType(value: string): value is MessageType {
  return (Object.values(MessageType) as string[]).includes(value);
}

function parseConnected(record: Record<string, unknown>): Result<ConnectedMessage, string> {
  const connectionId = record["connectionId"];
  if (typeof connectionId !== "string" || connectionId.length === 0) {
    return err("Connected message requires a non-empty connectionId.");
  }

  return ok({
    type: MessageType.Connected,
    connectionId,
  });
}

function parseCreateTunnel(record: Record<string, unknown>): Result<CreateTunnelMessage, string> {
  const requestId = record["requestId"];
  const port = record["port"];

  if (typeof requestId !== "string" || requestId.length === 0) {
    return err("CreateTunnel message requires a non-empty requestId.");
  }

  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65_535) {
    return err("CreateTunnel message requires an integer port between 1 and 65535.");
  }

  return ok({
    type: MessageType.CreateTunnel,
    requestId,
    port,
  });
}

function parseTunnelCreated(record: Record<string, unknown>): Result<TunnelCreatedMessage, string> {
  const requestId = record["requestId"];
  const tunnelId = record["tunnelId"];
  const publicUrl = record["publicUrl"];

  if (typeof requestId !== "string" || requestId.length === 0) {
    return err("TunnelCreated message requires a non-empty requestId.");
  }

  if (typeof tunnelId !== "string" || tunnelId.length === 0) {
    return err("TunnelCreated message requires a non-empty tunnelId.");
  }

  if (typeof publicUrl !== "string" || publicUrl.length === 0) {
    return err("TunnelCreated message requires a non-empty publicUrl.");
  }

  return ok({
    type: MessageType.TunnelCreated,
    requestId,
    tunnelId,
    publicUrl,
  });
}

function parseError(record: Record<string, unknown>): Result<ErrorMessage, string> {
  const code = record["code"];
  const message = record["message"];
  const requestId = record["requestId"];

  if (typeof code !== "string" || code.length === 0) {
    return err("Error message requires a non-empty code.");
  }

  if (typeof message !== "string" || message.length === 0) {
    return err("Error message requires a non-empty message.");
  }

  if (requestId !== undefined && (typeof requestId !== "string" || requestId.length === 0)) {
    return err("Error message requestId must be a non-empty string when present.");
  }

  const result: ErrorMessage = {
    type: MessageType.Error,
    code,
    message,
  };

  if (typeof requestId === "string") {
    return ok({ ...result, requestId });
  }

  return ok(result);
}

function parsePing(record: Record<string, unknown>): Result<PingMessage, string> {
  const requestId = record["requestId"];
  if (typeof requestId !== "string" || requestId.length === 0) {
    return err("Ping message requires a non-empty requestId.");
  }

  return ok({
    type: MessageType.Ping,
    requestId,
  });
}

function parsePong(record: Record<string, unknown>): Result<PongMessage, string> {
  const requestId = record["requestId"];
  if (typeof requestId !== "string" || requestId.length === 0) {
    return err("Pong message requires a non-empty requestId.");
  }

  return ok({
    type: MessageType.Pong,
    requestId,
  });
}
