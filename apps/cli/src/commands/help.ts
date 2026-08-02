import type { Command } from "commander";

import { promptSelect } from "../ui/prompts/select.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";

const HELP_SECTIONS: ReadonlyArray<{
  readonly id: string;
  readonly title: string;
  readonly body: string;
}> = [
  {
    id: "auth",
    title: "Authentication",
    body: `
badger login              Browser OAuth sign-in
badger login -t bgk_…     API key for CI
badger logout             Sign out (with confirmation)
badger whoami             Show identity

Tip: always pass -s ws://localhost:8080 when developing against a local server.
`.trim(),
  },
  {
    id: "workspace",
    title: "Workspace",
    body: `
badger workspace          Interactive picker
badger workspace list     Table of memberships
badger workspace use      Switch active workspace

Active workspace is stored locally and does not change your login tokens.
`.trim(),
  },
  {
    id: "tunnel",
    title: "Tunneling",
    body: `
badger <port>             Expose localhost (e.g. badger 3000)
badger <port> -w name     Override workspace for this run

Logged-in tunnels attach to your active workspace.
Without login, Badger runs in Anonymous Mode (tunnel only).
`.trim(),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    body: `
Open the web dashboard from:
  badger config → Open dashboard in browser

Or set Dashboard URL in badger config.
Requires a logged-in session for full features.
`.trim(),
  },
  {
    id: "apikeys",
    title: "API Keys",
    body: `
Create workspace API keys in the Badger dashboard
(Workspace → API keys), then:

  badger login -t bgk_your_key

API keys are ideal for CI/CD; they skip browser OAuth.
`.trim(),
  },
  {
    id: "config",
    title: "Configuration",
    body: `
badger config             Interactive settings
badger status             Login / server / latency overview

Settings live in ~/.config/badger/config.json
`.trim(),
  },
  {
    id: "trouble",
    title: "Troubleshooting",
    body: `
Not found on login
  Production may lack CLI OAuth. Use:
  badger login -s ws://localhost:8080

Unable to connect
  Check network and Server URL (badger config).

Wrong workspace
  badger workspace

Need help?
  badger help
`.trim(),
  },
];

/**
 * Interactive `badger help` menu.
 */
export class HelpCommand {
  constructor(private readonly writer: Writer) {}

  async execute(): Promise<void> {
    this.writer.writeLine(theme.brandLine("help"));
    this.writer.writeLine("");

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      for (const section of HELP_SECTIONS) {
        this.writer.writeLine(theme.heading(section.title));
        this.writer.writeLine(theme.muted(section.body));
        this.writer.writeLine("");
      }
      return;
    }

    for (;;) {
      const sectionId = await promptSelect({
        message: "Help",
        choices: [
          ...HELP_SECTIONS.map((section) => ({
            label: section.title,
            value: section.id,
          })),
          { label: "Exit help", value: "exit" },
        ],
      });

      if (sectionId === undefined || sectionId === "exit") {
        return;
      }

      const section = HELP_SECTIONS.find((row) => row.id === sectionId);
      if (section === undefined) {
        continue;
      }

      this.writer.writeLine("");
      this.writer.writeLine(theme.heading(section.title));
      this.writer.writeLine(theme.muted(section.body));
      this.writer.writeLine("");
    }
  }
}

export function registerHelpCommand(program: Command, command: HelpCommand): void {
  program
    .command("help")
    .description("Interactive help for Badger CLI")
    .action(() => {
      void command.execute();
    });
}
