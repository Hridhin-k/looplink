import { promptSelect } from "../ui/prompts/select.js";
import type { Writer } from "../utils/output.js";
import { openBrowser } from "../utils/open-browser.js";
import type { CliConfigStore } from "../services/cli-config-store.js";

export type RootMenuAction =
  | "tunnel"
  | "login"
  | "workspace"
  | "whoami"
  | "dashboard"
  | "logout"
  | "config"
  | "status"
  | "help";

/**
 * Interactive launcher when `badger` is run with no arguments.
 */
export async function runRootMenu(deps: {
  readonly writer: Writer;
  readonly configStore: CliConfigStore;
  readonly onTunnel: () => Promise<void>;
  readonly onLogin: () => Promise<void>;
  readonly onWorkspace: () => Promise<void>;
  readonly onWhoami: () => Promise<void>;
  readonly onLogout: () => Promise<void>;
  readonly onConfig: () => Promise<void>;
  readonly onStatus: () => Promise<void>;
  readonly onHelp: () => Promise<void>;
}): Promise<void> {
  const action = await promptSelect<RootMenuAction>({
    message: "What would you like to do?",
    choices: [
      { label: "Create Tunnel", value: "tunnel", hint: "Expose a local port" },
      { label: "Login", value: "login" },
      { label: "Switch Workspace", value: "workspace" },
      { label: "View Current Workspace", value: "whoami", hint: "Identity + workspace" },
      { label: "Open Dashboard", value: "dashboard" },
      { label: "Logout", value: "logout" },
      { label: "Configuration", value: "config" },
      { label: "Status", value: "status" },
      { label: "Help", value: "help" },
    ],
  });

  if (action === undefined) {
    return;
  }

  switch (action) {
    case "tunnel": {
      await deps.onTunnel();
      return;
    }
    case "login": {
      await deps.onLogin();
      return;
    }
    case "workspace": {
      await deps.onWorkspace();
      return;
    }
    case "whoami": {
      await deps.onWhoami();
      return;
    }
    case "dashboard": {
      const url = deps.configStore.load().dashboardUrl;
      await openBrowser(url);
      deps.writer.writeLine(`Opening ${url}`);
      return;
    }
    case "logout": {
      await deps.onLogout();
      return;
    }
    case "config": {
      await deps.onConfig();
      return;
    }
    case "status": {
      await deps.onStatus();
      return;
    }
    case "help": {
      await deps.onHelp();
      return;
    }
  }
}
