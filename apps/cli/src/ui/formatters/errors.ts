/**
 * Maps low-level failures to human-readable messages with recovery tips.
 */
export function formatFriendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message.trim() : String(error).trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("ehostunreach") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("socket hang up") ||
    lower.includes("server unreachable")
  ) {
    return [
      "Unable to connect to the Badger server.",
      "Please check your internet connection and that the server URL is correct.",
      "Tip: badger config → Server URL, or pass -s ws://localhost:8080",
    ].join("\n");
  }

  if (lower.includes("not logged in") || lower.includes("authentication required")) {
    return ["You are not logged in.", "Run: badger login"].join("\n");
  }

  if (lower.includes("workspace") && (lower.includes("not found") || lower.includes("no longer"))) {
    return [
      "The selected workspace is unavailable.",
      "Run: badger workspace",
      "to choose another workspace.",
    ].join("\n");
  }

  if (lower.includes("not found.") && lower.includes("cli/config")) {
    return [
      "This Badger server does not expose CLI login yet.",
      "Use a local/dev server: badger login -s ws://localhost:8080",
      "Or deploy a build that includes /api/v1/auth/cli/config.",
    ].join("\n");
  }

  if (raw.length === 0) {
    return "Something went wrong. Try again, or run: badger help";
  }

  return raw;
}
