#!/usr/bin/env node

import { basename } from "node:path";

import { Command } from "commander";

import { registerLoginCommand, LoginCommand } from "./commands/login.js";
import { registerLogoutCommand, LogoutCommand } from "./commands/logout.js";
import { registerReplayCommand, ReplayCommand } from "./commands/replay.js";
import { registerStartCommand, StartCommand } from "./commands/start.js";
import { registerWhoAmICommand, WhoAmICommand } from "./commands/whoami.js";
import { loadCliConfig } from "./config/cli.js";
import { AuthSessionManager } from "./services/auth-session-manager.js";
import { CliAuthApiClient } from "./services/cli-auth-api-client.js";
import { ReplayApiClient } from "./services/replay-api-client.js";
import { ShutdownController } from "./services/shutdown.js";
import { createDefaultServerConnection, StartTunnelService } from "./services/start-tunnel.js";
import { ConsoleSessionPresenter } from "./ui/console-session-presenter.js";
import { createSpinner } from "./ui/spinner.js";
import { argvForCommander } from "./utils/argv.js";
import { copyToClipboard } from "./utils/clipboard.js";
import { ConsoleWriter } from "./utils/output.js";
import { renderQrCode } from "./utils/qrcode.js";

/**
 * Warns when the deprecated `looplink` binary alias is used.
 *
 * The alias ships for one release so existing scripts keep working.
 */
function warnIfLegacyBinary(): void {
  const invoked = process.argv[1];
  if (invoked === undefined) {
    return;
  }

  const name = basename(invoked).replace(/\.(js|cjs|mjs|ts)$/u, "");
  if (name === "looplink") {
    console.warn(
      "[badger] The `looplink` command is deprecated; use `badger` instead. The alias will be removed in a future major release.",
    );
  }
}

warnIfLegacyBinary();

const config = loadCliConfig();
const writer = new ConsoleWriter();

const interactive = process.stderr.isTTY;
const presenter = new ConsoleSessionPresenter(
  writer,
  createSpinner(writer, interactive),
  {
    // A QR code is only useful in a terminal a human is looking at.
    showQrCode: process.stdout.isTTY,
    copyUrl: true,
  },
  { copyToClipboard, renderQrCode },
);

const shutdown = new ShutdownController({
  onShutdownStart: () => {
    presenter.shuttingDown();
  },
  onShutdownComplete: () => {
    presenter.stopped();
  },
});
shutdown.install();

const startTunnel = new StartTunnelService(presenter, createDefaultServerConnection, shutdown);
const authApi = new CliAuthApiClient();
const sessions = new AuthSessionManager(authApi);
const startCommand = new StartCommand(startTunnel, writer, sessions);
const replayCommand = new ReplayCommand(new ReplayApiClient(), writer);
const loginCommand = new LoginCommand(authApi, sessions, writer);
const logoutCommand = new LogoutCommand(authApi, sessions, writer);
const whoamiCommand = new WhoAmICommand(authApi, sessions, writer);

const program = new Command();

program.name(config.name).description(config.description).version(config.version);

registerReplayCommand(program, replayCommand);
registerStartCommand(program, startCommand);
registerLoginCommand(program, loginCommand);
registerLogoutCommand(program, logoutCommand);
registerWhoAmICommand(program, whoamiCommand);

// pnpm injects a literal `--` before script args; strip it so options parse.
program.parse(argvForCommander(process.argv));
