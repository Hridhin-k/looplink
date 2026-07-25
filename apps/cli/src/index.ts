#!/usr/bin/env node

import { Command } from "commander";

import { registerStartCommand, StartCommand } from "./commands/start.js";
import { loadCliConfig } from "./config/cli.js";
import { ShutdownController } from "./services/shutdown.js";
import { createDefaultServerConnection, StartTunnelService } from "./services/start-tunnel.js";
import { ConsoleSessionPresenter } from "./ui/console-session-presenter.js";
import { createSpinner } from "./ui/spinner.js";
import { copyToClipboard } from "./utils/clipboard.js";
import { ConsoleWriter } from "./utils/output.js";
import { renderQrCode } from "./utils/qrcode.js";

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
const startCommand = new StartCommand(startTunnel, writer);

const program = new Command();

program.name(config.name).description(config.description).version(config.version);

registerStartCommand(program, startCommand);

program.parse();
