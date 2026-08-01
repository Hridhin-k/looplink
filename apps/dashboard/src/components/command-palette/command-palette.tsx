"use client";

import { Command } from "cmdk";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ActivityIcon,
  ArrowRightIcon,
  CornerDownLeftIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ListTreeIcon,
  Loader2Icon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { MethodBadge } from "@/components/requests/method-badge";
import { StatusBadge } from "@/components/requests/status-badge";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInspectorRequests } from "@/hooks/use-inspector-requests";
import { useReplayRequest } from "@/hooks/use-replay-request";
import type { InspectorRequestSummary } from "@/lib/api";
import { duration, MACHINE_EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

const NAV_ACTIONS = [
  {
    id: "nav-overview",
    label: "Go to Overview",
    hint: "Live activity",
    href: "/overview",
    keywords: ["home", "dashboard", "live"],
    icon: LayoutDashboardIcon,
  },
  {
    id: "nav-requests",
    label: "Go to Requests",
    hint: "Timeline explorer",
    href: "/requests",
    keywords: ["inspector", "traffic", "http", "search"],
    icon: ListTreeIcon,
  },
  {
    id: "nav-statistics",
    label: "Open Statistics",
    hint: "Insights & charts",
    href: "/statistics",
    keywords: ["stats", "metrics", "analytics", "charts"],
    icon: ActivityIcon,
  },
  {
    id: "nav-workspace",
    label: "Open Workspace",
    hint: "Secrets, invites, members",
    href: "/workspace",
    keywords: ["settings", "team", "invite", "secret"],
    icon: SettingsIcon,
  },
  {
    id: "nav-account",
    label: "Open Account",
    hint: "Security center",
    href: "/account",
    keywords: ["profile", "security", "sessions", "email"],
    icon: UserIcon,
  },
] as const;

function matchesQuery(query: string, ...parts: readonly string[]): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return true;
  }
  return parts.some((part) => part.toLowerCase().includes(q));
}

function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS/i.test(navigator.userAgent);
}

/**
 * Raycast-inspired global command palette for Mission Control.
 */
export function CommandPalette() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const recentSearches = useCommandPaletteStore((s) => s.recentSearches);
  const addRecentSearch = useCommandPaletteStore((s) => s.addRecentSearch);
  const clearRecentSearches = useCommandPaletteStore((s) => s.clearRecentSearches);
  const removeRecentSearch = useCommandPaletteStore((s) => s.removeRecentSearch);

  const { memberships, activeWorkspace, setActiveWorkspaceId } = useWorkspace();
  const replay = useReplayRequest();

  const [query, setQuery] = useState("");
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 220);
  const modKey = isApplePlatform() ? "⌘" : "Ctrl";

  const searchActive = debouncedQuery.trim().length >= 2 && !/^\s*replay\b/i.test(debouncedQuery);
  const replayMode = /^\s*replay\b/i.test(query);
  const requestsQuery = useInspectorRequests({
    limit: searchActive ? 24 : 8,
    q: searchActive ? debouncedQuery.trim() : undefined,
  });

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setReplayingId(null);
  }, [setOpen]);

  const run = useCallback(
    (action: () => void, searchToRemember?: string) => {
      if (searchToRemember !== undefined && searchToRemember.trim().length > 0) {
        addRecentSearch(searchToRemember.trim());
      }
      close();
      action();
    },
    [addRecentSearch, close],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setReplayingId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const navItems = useMemo(
    () =>
      NAV_ACTIONS.filter((item) =>
        matchesQuery(query, item.label, item.hint, item.href, ...item.keywords),
      ),
    [query],
  );

  const workspaceItems = useMemo(
    () =>
      memberships.filter(
        (m) =>
          m.workspace.id !== activeWorkspace?.id &&
          matchesQuery(query, m.workspace.name, m.workspace.kind, "workspace", "switch"),
      ),
    [memberships, activeWorkspace?.id, query],
  );

  const requestItems = useMemo((): readonly InspectorRequestSummary[] => {
    const items = requestsQuery.data?.items ?? [];
    if (replayMode) {
      const rest = query.replace(/^\s*replay\b/i, "").trim();
      if (rest.length === 0) {
        return items.slice(0, 8);
      }
      return items
        .filter((item) =>
          matchesQuery(rest, item.method, item.path, item.id, String(item.status ?? "")),
        )
        .slice(0, 8);
    }
    if (searchActive) {
      return items;
    }
    if (query.trim().length === 0) {
      return items.slice(0, 5);
    }
    return items
      .filter((item) =>
        matchesQuery(query, item.method, item.path, item.id, String(item.status ?? "")),
      )
      .slice(0, 8);
  }, [requestsQuery.data?.items, searchActive, query, replayMode]);

  const showRecentSearches =
    query.trim().length === 0 && recentSearches.length > 0;

  const filteredRecents = useMemo(
    () =>
      recentSearches.filter((item) => matchesQuery(query, item, "recent", "search")),
    [recentSearches, query],
  );

  const showSearchAction = query.trim().length >= 1;

  const onReplay = (requestId: string): void => {
    setReplayingId(requestId);
    replay.mutate(requestId, {
      onSuccess: () => {
        run(() => {
          router.push(`/requests/${encodeURIComponent(requestId)}`);
        });
      },
      onSettled: () => {
        setReplayingId(null);
      },
      onError: () => {
        setReplayingId(null);
      },
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] sm:pt-[14vh]">
          <motion.button
            type="button"
            aria-label="Close command palette"
            className="absolute inset-0 bg-obsidian-canvas/70 backdrop-blur-[2px]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: duration.fast, ease: MACHINE_EASE }}
            onClick={close}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: duration.base, ease: MACHINE_EASE }}
            className="relative z-10 w-full max-w-[640px] overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-lift"
          >
            <Command
              label="Command palette"
              shouldFilter={false}
              loop
              className="flex max-h-[min(72vh,560px)] flex-col"
            >
              <div className="flex items-center gap-3 border-b border-ash-stroke px-4">
                <SearchIcon className="size-4 shrink-0 text-warm-granite" aria-hidden />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search pages, requests, workspaces…"
                  className="h-14 w-full bg-transparent text-[15px] text-bone outline-none placeholder:text-warm-granite"
                />
                {query.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-warm-granite"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <XIcon />
                  </Button>
                ) : (
                  <kbd className="hidden rounded-[3px] border border-ash-stroke px-1.5 py-0.5 font-mono text-[10px] text-warm-granite uppercase sm:inline">
                    esc
                  </kbd>
                )}
              </div>

              <Command.List className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 outline-none">
                <Command.Empty className="px-3 py-10 text-center text-sm text-warm-granite">
                  {requestsQuery.isFetching ? "Searching traffic…" : "No matching commands"}
                </Command.Empty>

                {navItems.length > 0 ? (
                  <Command.Group
                    heading="Navigate"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-pale-stone"
                  >
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <PaletteItem
                          key={item.id}
                          value={`${item.id} ${item.label} ${item.keywords.join(" ")}`}
                          icon={<Icon className="size-3.5" />}
                          label={item.label}
                          hint={item.hint}
                          shortcut={item.href}
                          onSelect={() => run(() => router.push(item.href))}
                        />
                      );
                    })}
                  </Command.Group>
                ) : null}

                {workspaceItems.length > 0 ? (
                  <Command.Group
                    heading="Switch workspace"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-pale-stone"
                  >
                    {workspaceItems.map((m) => (
                      <PaletteItem
                        key={m.workspace.id}
                        value={`workspace ${m.workspace.name} ${m.workspace.kind}`}
                        icon={<SettingsIcon className="size-3.5" />}
                        label={`Switch to ${m.workspace.name}`}
                        hint={m.workspace.kind}
                        onSelect={() =>
                          run(() => {
                            setActiveWorkspaceId(m.workspace.id);
                            router.push("/overview");
                          })
                        }
                      />
                    ))}
                  </Command.Group>
                ) : null}

                {showRecentSearches || (query.trim().length > 0 && filteredRecents.length > 0) ? (
                  <Command.Group
                    heading={
                      showRecentSearches ? (
                        <span className="flex w-full items-center justify-between gap-2">
                          <span>Recent searches</span>
                          <button
                            type="button"
                            className="text-[11px] tracking-normal text-warm-granite normal-case transition-machine hover:text-bone"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              clearRecentSearches();
                            }}
                          >
                            Clear
                          </button>
                        </span>
                      ) : (
                        "Recent searches"
                      )
                    }
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-pale-stone"
                  >
                    {(showRecentSearches ? recentSearches : filteredRecents).map((term) => (
                      <PaletteItem
                        key={`recent-${term}`}
                        value={`recent ${term}`}
                        icon={<HistoryIcon className="size-3.5" />}
                        label={term}
                        hint="Open in Requests"
                        onSelect={() =>
                          run(() => {
                            router.push(`/requests?q=${encodeURIComponent(term)}`);
                          }, term)
                        }
                        trailing={
                          <button
                            type="button"
                            aria-label={`Remove ${term}`}
                            className="rounded-[3px] p-1 text-warm-granite opacity-0 transition-machine group-data-[selected=true]:opacity-100 hover:text-bone"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              removeRecentSearch(term);
                            }}
                          >
                            <XIcon className="size-3" />
                          </button>
                        }
                      />
                    ))}
                  </Command.Group>
                ) : null}

                {showSearchAction ? (
                  <Command.Group
                    heading="Search"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-pale-stone"
                  >
                    <PaletteItem
                      value={`search-requests ${query}`}
                      icon={<SearchIcon className="size-3.5" />}
                      label={`Search requests for “${query.trim()}”`}
                      hint="Explorer"
                      onSelect={() =>
                        run(() => {
                          router.push(`/requests?q=${encodeURIComponent(query.trim())}`);
                        }, query.trim())
                      }
                    />
                  </Command.Group>
                ) : null}

                {requestItems.length > 0 || (searchActive && requestsQuery.isFetching) ? (
                  <Command.Group
                    heading={
                      replayMode ? "Replay request" : searchActive ? "Requests" : "Recent requests"
                    }
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-pale-stone"
                  >
                    {searchActive && requestsQuery.isFetching && requestItems.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-warm-granite">
                        <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />
                        Searching…
                      </div>
                    ) : null}
                    {requestItems.map((item) => (
                      <div key={item.id} className="contents">
                        {!replayMode ? (
                          <PaletteItem
                            value={`request open ${item.method} ${item.path} ${item.id}`}
                            icon={<ListTreeIcon className="size-3.5" />}
                            label={
                              <span className="flex min-w-0 items-center gap-2">
                                <MethodBadge method={item.method} />
                                <span className="truncate font-mono text-[13px]">{item.path}</span>
                              </span>
                            }
                            hint={
                              <span className="inline-flex items-center gap-2">
                                <StatusBadge status={item.status} />
                                {item.latencyMs !== undefined ? (
                                  <span className="font-mono text-[10px] tabular-nums">
                                    {String(item.latencyMs)}ms
                                  </span>
                                ) : null}
                              </span>
                            }
                            onSelect={() =>
                              run(() => {
                                router.push(`/requests/${encodeURIComponent(item.id)}`);
                              }, query.trim() || undefined)
                            }
                          />
                        ) : null}
                        {replayMode || searchActive ? (
                          <PaletteItem
                            value={`request replay ${item.method} ${item.path} ${item.id}`}
                            icon={
                              replayingId === item.id ? (
                                <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" />
                              ) : (
                                <RotateCcwIcon className="size-3.5" />
                              )
                            }
                            label={`Replay ${item.method.toUpperCase()} ${item.path}`}
                            hint="Live tunnel"
                            disabled={replayingId !== null}
                            onSelect={() => {
                              if (replayingId !== null) {
                                return;
                              }
                              onReplay(item.id);
                            }}
                          />
                        ) : null}
                      </div>
                    ))}
                  </Command.Group>
                ) : null}
              </Command.List>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ash-stroke bg-obsidian-canvas/50 px-3 py-2.5">
                <p className="text-caption text-warm-granite">
                  {activeWorkspace?.name ?? "Command"}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-warm-granite">
                  <Hint keys={["↑", "↓"]} label="Navigate" />
                  <Hint
                    keys={[
                      <CornerDownLeftIcon key="enter" className="size-3" />,
                    ]}
                    label="Open"
                  />
                  <Hint keys={[`${modKey}K`]} label="Toggle" />
                </div>
              </footer>
            </Command>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function PaletteItem({
  value,
  icon,
  label,
  hint,
  shortcut,
  trailing,
  disabled = false,
  onSelect,
}: {
  readonly value: string;
  readonly icon: ReactNode;
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly shortcut?: string;
  readonly trailing?: ReactNode;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-[3px] px-2 py-2 text-sm text-bone outline-none select-none",
        "data-[selected=true]:bg-obsidian-canvas",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40",
        "transition-machine",
      )}
    >
      <span
        className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-signal-orange opacity-0 group-data-[selected=true]:opacity-100"
        aria-hidden
      />
      <span className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border border-ash-stroke bg-obsidian-canvas text-pale-stone">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint !== undefined ? (
        <span className="hidden max-w-[40%] shrink-0 truncate text-xs text-warm-granite sm:inline">
          {hint}
        </span>
      ) : null}
      {shortcut !== undefined ? (
        <span className="hidden shrink-0 font-mono text-[10px] text-graphite-mid sm:inline">
          {shortcut}
        </span>
      ) : (
        <ArrowRightIcon className="size-3.5 shrink-0 text-graphite-mid opacity-0 group-data-[selected=true]:opacity-100" />
      )}
      {trailing}
    </Command.Item>
  );
}

function Hint({
  keys,
  label,
}: {
  readonly keys: readonly ReactNode[];
  readonly label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {keys.map((key, index) => (
        <kbd
          key={index}
          className="inline-flex min-w-5 items-center justify-center rounded-[3px] border border-ash-stroke bg-carbon-lift px-1 py-0.5 font-mono text-[10px] text-pale-stone"
        >
          {key}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}
