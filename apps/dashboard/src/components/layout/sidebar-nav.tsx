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
        const active =
          !item.disabled && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));

        const itemClass = cn(
          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
          item.disabled && "pointer-events-none cursor-not-allowed opacity-45 hover:bg-transparent",
        );

        const title = collapsed ? `${item.label}${item.disabled ? " (soon)" : ""}` : undefined;

        const label = (
          <>
            <Icon className="size-4 shrink-0" aria-hidden />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="truncate">
                {item.label}
                {item.disabled ? (
                  <span className="ml-2 text-[10px] tracking-wide text-muted-foreground uppercase">
                    Soon
                  </span>
                ) : null}
              </span>
            )}
          </>
        );

        if (item.disabled) {
          return (
            <span key={item.id} className={itemClass} aria-disabled="true" title={title}>
              {label}
            </span>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className={itemClass}
            aria-current={active ? "page" : undefined}
            title={title}
            onClick={onNavigate}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
