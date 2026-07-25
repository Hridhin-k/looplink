#!/usr/bin/env node

import { Command } from "commander";

import { registerStartCommand, StartCommand } from "./commands/start.js";
import { loadCliConfig } from "./config/cli.js";
import { StartTunnelService } from "./services/start-tunnel.js";
import { LoopLinkWebSocketClient } from "./services/websocket-client.js";
import { ConsoleWriter } from "./utils/output.js";

const config = loadCliConfig();
const writer = new ConsoleWriter();
const startTunnel = new StartTunnelService(
  writer,
  (serverUrl) =>
    new LoopLinkWebSocketClient({
      url: serverUrl,
      reconnect: false,
    }),
);
const startCommand = new StartCommand(startTunnel, writer);

const program = new Command();

program.name(config.name).description(config.description).version(config.version);

registerStartCommand(program, startCommand);

program.parse();
