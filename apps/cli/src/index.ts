#!/usr/bin/env node

import { basename } from "node:path";

import { Command } from "commander";
import * as clack from "@clack/prompts";

import { registerConfigCommand, ConfigCommand } from "./commands/config.js";
import { registerHelpCommand, HelpCommand } from "./commands/help.js";
import { registerLoginCommand, LoginCommand } from "./commands/login.js";
import { registerLogoutCommand, LogoutCommand } from "./commands/logout.js";
import { runRootMenu } from "./commands/menu.js";
import { registerReplayCommand, ReplayCommand } from "./commands/replay.js";
import { registerStartCommand, StartCommand } from "./commands/start.js";
import { registerStatusCommand, StatusCommand } from "./commands/status.js";
import { registerWhoAmICommand, WhoAmICommand } from "./commands/whoami.js";
import { registerWorkspaceCommand, WorkspaceCommand } from "./commands/workspace.js";
import { loadCliConfig } from "./config/cli.js";
import { AuthSessionManager } from "./services/auth-session-manager.js";
import { AnonymousSessionApiClient } from "./services/anonymous-session-api-client.js";
import { CliAuthApiClient } from "./services/cli-auth-api-client.js";
import { CliConfigStore } from "./services/cli-config-store.js";
import { ReplayApiClient } from "./services/replay-api-client.js";
import { ShutdownController } from "./services/shutdown.js";
import { createDefaultServerConnection, StartTunnelService } from "./services/start-tunnel.js";
import { WorkspacePreferenceStore } from "./services/workspace-preference-store.js";
import { printWelcomeBanner } from "./ui/brand.js";
import { ConsoleSessionPresenter } from "./ui/console-session-presenter.js";
import { createSpinner } from "./ui/spinner.js";
import { setAnimationsPreference } from "./ui/animations.js";
import { theme } from "./ui/theme.js";
import { argvForCommander } from "./utils/argv.js";
import { copyToClipboard } from "./utils/clipboard.js";
import { ConsoleWriter } from "./utils/output.js";
import { renderQrCode } from "./utils/qrcode.js";

/**
 * Warns when the deprecated `looplink` binary alias is used.
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
const configStore = new CliConfigStore();
const userConfig = configStore.load();
setAnimationsPreference(userConfig.animations);

const interactive = process.stderr.isTTY;
const presenter = new ConsoleSessionPresenter(
  writer,
  createSpinner(writer, interactive),
  {
    showQrCode: process.stdout.isTTY && userConfig.showQrCode,
    copyUrl: userConfig.autoCopyUrl,
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
const workspacePreferences = new WorkspacePreferenceStore();
const anonymousSessions = new AnonymousSessionApiClient();
const workspaceCommand = new WorkspaceCommand(authApi, sessions, workspacePreferences, writer);
const startCommand = new StartCommand(
  startTunnel,
  writer,
  sessions,
  authApi,
  workspacePreferences,
  anonymousSessions,
  shutdown,
  presenter,
);
const replayCommand = new ReplayCommand(
  new ReplayApiClient(),
  writer,
  sessions,
  workspacePreferences,
);
const loginCommand = new LoginCommand(authApi, sessions, writer, workspaceCommand);
const logoutCommand = new LogoutCommand(authApi, sessions, writer);
const whoamiCommand = new WhoAmICommand(authApi, sessions, writer, workspacePreferences);
const statusCommand = new StatusCommand(
  authApi,
  sessions,
  workspacePreferences,
  configStore,
  writer,
);
const configCommand = new ConfigCommand(configStore, workspacePreferences, writer);
const helpCommand = new HelpCommand(writer);

const program = new Command();

program.name(config.name).description(config.description).version(config.version);
program.enablePositionalOptions();

registerReplayCommand(program, replayCommand);
registerStartCommand(program, startCommand, {
  onNoPort: async () => {
    await printWelcomeBanner(writer, config);
    await runRootMenu({
      writer,
      configStore,
      onTunnel: async () => {
        const port = await promptPort();
        if (port === undefined) {
          return;
        }
        await startCommand.execute(port, {});
      },
      onLogin: async () => loginCommand.execute({}),
      onWorkspace: async () => workspaceCommand.show({}),
      onWhoami: async () => whoamiCommand.execute({}),
      onLogout: async () => logoutCommand.execute({}),
      onConfig: async () => configCommand.execute(),
      onStatus: async () => statusCommand.execute({}),
      onHelp: async () => helpCommand.execute(),
    });
  },
});
registerLoginCommand(program, loginCommand);
registerLogoutCommand(program, logoutCommand);
registerWhoAmICommand(program, whoamiCommand);
registerWorkspaceCommand(program, workspaceCommand);
registerStatusCommand(program, statusCommand);
registerConfigCommand(program, configCommand);
registerHelpCommand(program, helpCommand);

program.parse(argvForCommander(process.argv));

async function promptPort(): Promise<string | undefined> {
  if (!process.stdin.isTTY) {
    writer.writeError(theme.error("Pass a port: badger <port>"));
    return undefined;
  }
  const result = await clack.text({
    message: "Local port to expose",
    placeholder: "3000",
    initialValue: "3000",
    validate: (value) => {
      const n = Number((value ?? "").trim());
      if (!Number.isInteger(n) || n < 1 || n > 65535) {
        return "Enter a port between 1 and 65535";
      }
      return undefined;
    },
  });
  if (clack.isCancel(result)) {
    clack.cancel(theme.muted("Cancelled."));
    return undefined;
  }
  return result.trim();
}
