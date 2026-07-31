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
    <nav aria-label="Primary" className={cn("flex flex-col gap-1", className)}>
      {APP_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex w-full items-center gap-3 rounded-[3px] px-2.5 py-2 text-sm transition-colors duration-150",
              collapsed && "justify-center px-0",
              active
                ? "bg-carbon-lift text-bone"
                : "text-warm-granite hover:bg-carbon-lift/70 hover:text-bone",
            )}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
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
