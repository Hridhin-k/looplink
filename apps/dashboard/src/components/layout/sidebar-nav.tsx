"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { APP_NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  readonly collapsed?: boolean;
  readonly onNavigate?: () => void;
  readonly className?: string;
}

/**
 * Shared nav list for desktop sidebar and mobile sheet.
 */
export function SidebarNav({ collapsed = false, onNavigate, className }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className={cn("flex flex-col gap-0.5", className)}>
      {APP_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-[3px] px-2.5 py-2 text-sm transition-machine focus-visible:bg-carbon-lift focus-visible:text-bone",
              collapsed && "justify-center px-0",
              active
                ? "bg-carbon-lift text-bone"
                : "text-warm-granite hover:bg-carbon-lift/60 hover:text-bone",
            )}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
          >
            {active ? (
              <span
                className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-signal-orange"
                aria-hidden
              />
            ) : null}
            <Icon
              className={cn(
                "size-4 shrink-0 transition-machine",
                active ? "text-bone" : "text-warm-granite group-hover:text-bone",
              )}
              aria-hidden
            />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="truncate font-mono text-[12px] tracking-[-0.02em] uppercase">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
