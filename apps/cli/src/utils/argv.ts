/**
 * Returns argv suitable for Commander when the CLI is launched via pnpm.
 *
 * `pnpm run <script> -- <args>` inserts a literal `"--"` before the user
 * arguments. Commander treats that token as "end of options", so flags such as
 * `--server` are misread as extra positional arguments. Strip the single
 * injected separator when it is the first user token.
 *
 * @param argv - Typically `process.argv`.
 * @returns Argv with a leading user `--` removed when present.
 */
export function argvForCommander(argv: readonly string[]): string[] {
  if (argv[2] === "--") {
    return [...argv.slice(0, 2), ...argv.slice(3)];
  }

  return [...argv];
}
