import type { KeyValueEntry } from "@/lib/request-body";

export interface HeaderGroup {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly KeyValueEntry[];
}

const GROUP_RULES: readonly {
  readonly id: string;
  readonly label: string;
  readonly match: (key: string) => boolean;
}[] = [
  {
    id: "general",
    label: "General",
    match: (key) =>
      /^(host|connection|content-length|content-type|accept|accept-encoding|accept-language|user-agent|date|server|via|te|upgrade)$/i.test(
        key,
      ),
  },
  {
    id: "cache",
    label: "Cache",
    match: (key) => /^(cache-|etag|if-|expires|pragma|age|last-modified|vary)/i.test(key),
  },
  {
    id: "security",
    label: "Security",
    match: (key) =>
      /^(authorization|cookie|set-cookie|x-csrf|x-xsrf|origin|referer|sec-|strict-transport|content-security|x-frame|x-content-type|x-xss|access-control)/i.test(
        key,
      ),
  },
  {
    id: "content",
    label: "Content",
    match: (key) =>
      /^(content-|transfer-encoding|content-disposition|content-range|accept-ranges|range)/i.test(
        key,
      ) && !/^(content-length|content-type)$/i.test(key),
  },
];

/**
 * Groups header/query entries into DevTools-style sections.
 */
export function groupHeaderEntries(entries: readonly KeyValueEntry[]): readonly HeaderGroup[] {
  const remaining = [...entries];
  const groups: HeaderGroup[] = [];

  for (const rule of GROUP_RULES) {
    const matched: KeyValueEntry[] = [];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const entry = remaining[i]!;
      if (rule.match(entry.key)) {
        matched.unshift(entry);
        remaining.splice(i, 1);
      }
    }
    if (matched.length > 0) {
      groups.push({ id: rule.id, label: rule.label, entries: matched });
    }
  }

  if (remaining.length > 0) {
    groups.push({ id: "other", label: "Other", entries: remaining });
  }

  return groups;
}
