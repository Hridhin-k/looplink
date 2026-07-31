import boxen from "boxen";
import gradient from "gradient-string";
import logSymbols from "log-symbols";

import { theme } from "../theme.js";
import { colorizeDrawing } from "../drawings/mascot.js";

/**
 * Compact “online” badge drawn above the tunnel box.
 */
export function formatTunnelLiveArt(): string {
  const art = [
    "  [local]──▷──( 🦡 )──▷──[public]",
    "     dig         tunnel",
  ].join("\n");
  return colorizeDrawing(art);
}

/**
 * Boxed tunnel summary used after create / reconnect.
 */
export function formatTunnelBox(input: {
  readonly workspaceLabel: string;
  readonly localUrl: string;
  readonly publicUrl: string;
  readonly mode: "workspace" | "anonymous";
}): string {
  const lines = [
    `${theme.label("Workspace")}  ${
      input.mode === "anonymous"
        ? theme.warning("Anonymous Mode")
        : theme.highlight(input.workspaceLabel)
    }`,
    `${theme.label("Local")}      ${theme.muted(input.localUrl)}`,
    `${theme.label("Public")}     ${theme.url(input.publicUrl)}`,
  ].join("\n");

  return boxen(lines, {
    padding: 1,
    borderStyle: "single",
    borderColor: "cyan",
    dimBorder: true,
  });
}

/**
 * Anonymous-mode capability summary shown before tunnel start.
 */
export function formatAnonymousModeNotice(): string {
  const available = [
    `${cliSymbol("success")} Public Tunnel`,
    `${cliSymbol("success")} HTTPS`,
    `${cliSymbol("success")} QR Code`,
  ].join("\n");
  const unavailable = [
    `${cliSymbol("error")} Dashboard`,
    `${cliSymbol("error")} Replay`,
    `${cliSymbol("error")} History`,
    `${cliSymbol("error")} Teams`,
    `${cliSymbol("error")} API Keys`,
  ].join("\n");

  const body = [
    theme.warning("Running in Anonymous Mode"),
    "",
    theme.label("Features available"),
    available,
    "",
    theme.label("Unavailable"),
    unavailable,
  ].join("\n");

  return boxen(body, {
    padding: 1,
    borderStyle: "single",
    borderColor: "yellow",
    dimBorder: true,
  });
}

/**
 * Success line with symbol.
 */
export function formatSuccessLine(message: string): string {
  return `${theme.success(cliSymbol("success"))} ${message}`;
}

/**
 * Optional branded gradient helper for banners.
 */
export function brandGradient(text: string): string {
  if (!process.stdout.isTTY || process.env["NO_COLOR"] !== undefined) {
    return text;
  }
  return gradient(["#22d3ee", "#3b82f6"])(text);
}

export function cliSymbol(kind: "success" | "error" | "warning" | "info"): string {
  const value = logSymbols[kind];
  return typeof value === "string" ? value : kind === "success" ? "✔" : "✖";
}
