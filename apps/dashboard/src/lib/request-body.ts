/**
 * Utilities for decoding inspector traffic bodies and parsing header maps.
 */

export type HeaderMap = Record<string, string | readonly string[]>;

export interface KeyValueEntry {
  readonly key: string;
  readonly value: string;
}

export type BodyLanguage = "json" | "html" | "xml" | "css" | "javascript" | "plaintext";

export interface DecodedBody {
  readonly text: string;
  readonly formatted: string;
  readonly language: BodyLanguage;
  readonly isEmpty: boolean;
  readonly isBinary: boolean;
  readonly byteLength: number;
  readonly truncated: boolean;
}

/**
 * Flattens a header/query map into sorted key/value rows.
 */
export function flattenHeaderMap(map: HeaderMap | undefined): KeyValueEntry[] {
  if (map === undefined) {
    return [];
  }

  const entries: KeyValueEntry[] = [];
  for (const [key, raw] of Object.entries(map)) {
    if (Array.isArray(raw)) {
      for (const value of raw) {
        entries.push({ key, value: String(value) });
      }
    } else {
      entries.push({ key, value: String(raw) });
    }
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Finds the first header value matching `name` (case-insensitive).
 */
export function getHeaderValue(map: HeaderMap, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, raw] of Object.entries(map)) {
    if (key.toLowerCase() !== target) {
      continue;
    }
    if (Array.isArray(raw)) {
      return raw.length > 0 ? String(raw[0]) : undefined;
    }
    return String(raw);
  }
  return undefined;
}

/**
 * Collects all values for a header name (case-insensitive).
 */
export function getHeaderValues(map: HeaderMap, name: string): string[] {
  const target = name.toLowerCase();
  const values: string[] = [];
  for (const [key, raw] of Object.entries(map)) {
    if (key.toLowerCase() !== target) {
      continue;
    }
    if (Array.isArray(raw)) {
      for (const value of raw) {
        values.push(String(value));
      }
    } else {
      values.push(String(raw));
    }
  }
  return values;
}

/**
 * Parses a `Cookie` request header into name/value pairs.
 */
export function parseCookieHeader(cookieHeader: string | undefined): KeyValueEntry[] {
  if (cookieHeader === undefined || cookieHeader.trim().length === 0) {
    return [];
  }

  const entries: KeyValueEntry[] = [];
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      entries.push({ key: trimmed, value: "" });
      continue;
    }
    entries.push({
      key: trimmed.slice(0, eq).trim(),
      value: trimmed.slice(eq + 1).trim(),
    });
  }
  return entries;
}

/**
 * Parses `Set-Cookie` response header values into display rows.
 */
export function parseSetCookieHeaders(setCookies: readonly string[]): KeyValueEntry[] {
  return setCookies.map((raw) => {
    const [pair] = raw.split(";");
    const eq = pair?.indexOf("=") ?? -1;
    if (pair === undefined || eq === -1) {
      return { key: raw, value: "" };
    }
    return {
      key: pair.slice(0, eq).trim(),
      value: pair.slice(eq + 1).trim(),
    };
  });
}

/**
 * Decodes a base64 traffic body, pretty-prints JSON when possible, detects language.
 */
export function decodeTrafficBody(
  body: { readonly dataBase64: string; readonly byteLength: number; readonly truncated: boolean },
  contentType?: string,
): DecodedBody {
  if (body.dataBase64.length === 0 || body.byteLength === 0) {
    return {
      text: "",
      formatted: "",
      language: "plaintext",
      isEmpty: true,
      isBinary: false,
      byteLength: body.byteLength,
      truncated: body.truncated,
    };
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(body.dataBase64);
    bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  } catch {
    return {
      text: body.dataBase64,
      formatted: body.dataBase64,
      language: "plaintext",
      isEmpty: false,
      isBinary: true,
      byteLength: body.byteLength,
      truncated: body.truncated,
    };
  }

  if (looksBinary(bytes)) {
    const preview = Array.from(bytes.slice(0, 64))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    return {
      text: preview,
      formatted: `${preview}${bytes.length > 64 ? " …" : ""}\n\n(${String(bytes.length)} bytes, binary)`,
      language: "plaintext",
      isEmpty: false,
      isBinary: true,
      byteLength: body.byteLength,
      truncated: body.truncated,
    };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const language = detectLanguage(text, contentType);
  const formatted = language === "json" ? tryFormatJson(text) : text;

  return {
    text,
    formatted,
    language,
    isEmpty: text.length === 0,
    isBinary: false,
    byteLength: body.byteLength,
    truncated: body.truncated,
  };
}

function looksBinary(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return false;
  }
  let suspicious = 0;
  const sample = Math.min(bytes.length, 512);
  for (let i = 0; i < sample; i += 1) {
    const b = bytes[i]!;
    if (b === 0) {
      return true;
    }
    if (b < 7 || (b > 13 && b < 32)) {
      suspicious += 1;
    }
  }
  return suspicious / sample > 0.3;
}

function detectLanguage(text: string, contentType?: string): BodyLanguage {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("json") || ct.includes("+json")) {
    return "json";
  }
  if (ct.includes("html")) {
    return "html";
  }
  if (ct.includes("xml")) {
    return "xml";
  }
  if (ct.includes("css")) {
    return "css";
  }
  if (ct.includes("javascript") || ct.includes("ecmascript")) {
    return "javascript";
  }

  const trimmed = text.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // fall through
    }
  }

  return "plaintext";
}

function tryFormatJson(text: string): string {
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    return text;
  }
}
