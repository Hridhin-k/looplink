import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  BookOpenIcon,
  LayoutDashboardIcon,
  ListTreeIcon,
  NetworkIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";

export interface AppNavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

/**
 * Primary sidebar destinations — only shipped, working routes.
 */
export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/overview",
    icon: LayoutDashboardIcon,
  },
  {
    id: "tunnels",
    label: "Tunnels",
    href: "/tunnels",
    icon: NetworkIcon,
  },
  {
    id: "requests",
    label: "Requests",
    href: "/requests",
    icon: ListTreeIcon,
  },
  {
    id: "statistics",
    label: "Statistics",
    href: "/statistics",
    icon: ActivityIcon,
  },
  {
    id: "workspace",
    label: "Workspace",
    href: "/workspace",
    icon: SettingsIcon,
  },
  {
    id: "account",
    label: "Account",
    href: "/account",
    icon: UserIcon,
  },
  {
    id: "docs",
    label: "Docs",
    href: "/docs",
    icon: BookOpenIcon,
  },
] as const;
