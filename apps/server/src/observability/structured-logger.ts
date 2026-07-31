import { Injectable, Logger, type LogLevel } from "@nestjs/common";

export type StructuredLogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * JSON-oriented logger for production; Nest Logger for local readability.
 */
@Injectable()
export class StructuredLogger {
  private readonly nest = new Logger("Badger");

  log(message: string, fields: StructuredLogFields = {}): void {
    this.write("log", message, fields);
  }

  warn(message: string, fields: StructuredLogFields = {}): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields: StructuredLogFields = {}): void {
    this.write("error", message, fields);
  }

  debug(message: string, fields: StructuredLogFields = {}): void {
    this.write("debug", message, fields);
  }

  private write(level: LogLevel, message: string, fields: StructuredLogFields): void {
    if (process.env["NODE_ENV"] === "production" || process.env["BADGER_STRUCTURED_LOGS"] === "1") {
      const payload = {
        level,
        message,
        ts: new Date().toISOString(),
        service: "badger-server",
        ...sanitize(fields),
      };
      process.stdout.write(`${JSON.stringify(payload)}\n`);
      return;
    }

    const suffix = Object.keys(fields).length > 0 ? ` ${JSON.stringify(sanitize(fields))}` : "";
    switch (level) {
      case "error":
        this.nest.error(`${message}${suffix}`);
        break;
      case "warn":
        this.nest.warn(`${message}${suffix}`);
        break;
      case "debug":
        this.nest.debug(`${message}${suffix}`);
        break;
      default:
        this.nest.log(`${message}${suffix}`);
    }
  }
}

function sanitize(fields: StructuredLogFields): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    // Never log secrets / tokens.
    if (/token|password|secret|authorization|cookie/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = value;
  }
  return out;
}
