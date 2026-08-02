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
              "group relative flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium tracking-[0.01em] transition-machine focus-visible:bg-obsidian focus-visible:text-pure-white",
              collapsed && "justify-center px-0",
              active
                ? "row-active text-pure-white"
                : "text-ash hover:bg-obsidian/60 hover:text-pure-white",
            )}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-machine",
                active ? "text-pure-white" : "text-ash group-hover:text-pure-white",
              )}
              aria-hidden
            />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="truncate">{item.label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
