import type { Command } from "commander";

import { CliConfigStore, type CliUserConfig } from "../services/cli-config-store.js";
import { WorkspacePreferenceStore } from "../services/workspace-preference-store.js";
import { resolveServerUrl } from "../config/server.js";
import { setAnimationsPreference } from "../ui/animations.js";
import { formatSuccessLine } from "../ui/formatters/boxes.js";
import { promptSelect } from "../ui/prompts/select.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";
import { openBrowser } from "../utils/open-browser.js";

type ConfigAction =
  | "view"
  | "autoCopyUrl"
  | "autoOpenBrowser"
  | "showQrCode"
  | "animations"
  | "telemetry"
  | "dashboardUrl"
  | "serverUrl"
  | "openDashboard"
  | "done";

/**
 * Interactive `badger config` settings.
 */
export class ConfigCommand {
  constructor(
    private readonly configStore: CliConfigStore,
    private readonly preferences: WorkspacePreferenceStore,
    private readonly writer: Writer,
  ) {}

  async execute(): Promise<void> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.printConfig(this.configStore.load());
      return;
    }

    for (;;) {
      const config = this.configStore.load();
      const action = await promptSelect<ConfigAction>({
        message: "Configuration",
        choices: [
          {
            label: "View current settings",
            value: "view",
            hint: summarize(config),
          },
          {
            label: `Auto copy URL — ${onOff(config.autoCopyUrl)}`,
            value: "autoCopyUrl",
          },
          {
            label: `Auto open browser — ${onOff(config.autoOpenBrowser)}`,
            value: "autoOpenBrowser",
          },
          {
            label: `Show QR code — ${onOff(config.showQrCode)}`,
            value: "showQrCode",
          },
          {
            label: `Animations — ${onOff(config.animations)}`,
            value: "animations",
          },
          {
            label: `Telemetry — ${onOff(config.telemetry)}`,
            value: "telemetry",
          },
          {
            label: "Dashboard URL",
            value: "dashboardUrl",
            hint: config.dashboardUrl,
          },
          {
            label: "Server URL",
            value: "serverUrl",
            hint: config.serverUrl.length > 0 ? config.serverUrl : "(default)",
          },
          {
            label: "Open dashboard in browser",
            value: "openDashboard",
          },
          { label: "Done", value: "done" },
        ],
      });

      if (action === undefined || action === "done") {
        return;
      }

      if (action === "view") {
        this.printConfig(config);
        const preferred = this.preferences.load(resolveServerUrl());
        this.writer.writeLine(
          `${theme.label("Default workspace")}  ${
            preferred?.workspaceName ?? preferred?.workspaceId ?? theme.muted("(none)")
          }`,
        );
        this.writer.writeLine(theme.muted("Change workspace with: badger workspace"));
        continue;
      }

      if (action === "openDashboard") {
        await openBrowser(config.dashboardUrl);
        this.writer.writeLine(formatSuccessLine(`Opening ${config.dashboardUrl}`));
        continue;
      }

      if (action === "dashboardUrl" || action === "serverUrl") {
        const next = await promptUrl(action === "dashboardUrl" ? "Dashboard URL" : "Server URL", {
          dashboardUrl: config.dashboardUrl,
          serverUrl: config.serverUrl.length > 0 ? config.serverUrl : "wss://looplinkserver-production.up.railway.app",
        }[action]);
        if (next === undefined) {
          continue;
        }
        this.configStore.save(
          action === "dashboardUrl" ? { dashboardUrl: next } : { serverUrl: next },
        );
        this.writer.writeLine(formatSuccessLine("Saved."));
        continue;
      }

      const toggled = !config[action];
      const next = this.configStore.save({ [action]: toggled });
      if (action === "animations") {
        setAnimationsPreference(next.animations);
      }
      this.writer.writeLine(formatSuccessLine(`${action} → ${onOff(toggled)}`));
    }
  }

  private printConfig(config: CliUserConfig): void {
    this.writer.writeLine(`${theme.label("Auto copy URL")}     ${onOff(config.autoCopyUrl)}`);
    this.writer.writeLine(`${theme.label("Auto open browser")} ${onOff(config.autoOpenBrowser)}`);
    this.writer.writeLine(`${theme.label("Show QR code")}      ${onOff(config.showQrCode)}`);
    this.writer.writeLine(`${theme.label("Animations")}        ${onOff(config.animations)}`);
    this.writer.writeLine(`${theme.label("Telemetry")}         ${onOff(config.telemetry)}`);
    this.writer.writeLine(`${theme.label("Dashboard URL")}     ${config.dashboardUrl}`);
    this.writer.writeLine(
      `${theme.label("Server URL")}        ${
        config.serverUrl.length > 0 ? config.serverUrl : theme.muted("(built-in default)")
      }`,
    );
  }
}

function onOff(value: boolean): string {
  return value ? theme.success("on") : theme.muted("off");
}

function summarize(config: CliUserConfig): string {
  return `copy ${onOff(config.autoCopyUrl)} · qr ${onOff(config.showQrCode)}`;
}

async function promptUrl(message: string, initial: string): Promise<string | undefined> {
  const clack = await import("@clack/prompts");
  if (!process.stdin.isTTY) {
    return undefined;
  }
  const result = await clack.text({
    message,
    initialValue: initial,
    validate: (value) => {
      const trimmed = (value ?? "").trim();
      if (trimmed.length === 0) {
        return "URL is required";
      }
      try {
        new URL(trimmed);
        return undefined;
      } catch {
        return "Enter a valid URL";
      }
    },
  });
  if (clack.isCancel(result)) {
    clack.cancel(theme.muted("Cancelled."));
    return undefined;
  }
  return result.trim();
}

export function registerConfigCommand(program: Command, command: ConfigCommand): void {
  program
    .command("config")
    .description("Interactive CLI settings")
    .addHelpText(
      "after",
      `
Examples:
  $ badger config

Related:
  badger status
  badger workspace
`,
    )
    .action(() => {
      void command.execute();
    });
}
