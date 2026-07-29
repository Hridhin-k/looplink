import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  CableIcon,
  LayoutDashboardIcon,
  ListTreeIcon,
  SettingsIcon,
} from "lucide-react";

export interface AppNavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /** When true, item is visible but not navigable yet. */
  readonly disabled?: boolean;
}

/**
 * Primary sidebar destinations. Overview, Requests, and Statistics are live.
 */
export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/",
    icon: LayoutDashboardIcon,
  },
  {
    id: "requests",
    label: "Requests",
    href: "/requests",
    icon: ListTreeIcon,
  },
  {
    id: "tunnels",
    label: "Tunnels",
    href: "/tunnels",
    icon: CableIcon,
    disabled: true,
  },
  {
    id: "statistics",
    label: "Statistics",
    href: "/statistics",
    icon: ActivityIcon,
  },
  {
    id: "settings",
    label: "Workspace",
    href: "/workspace",
    icon: SettingsIcon,
  },
] as const;
