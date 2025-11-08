import type React from "react";
import type { PaywallContext } from "@/types/paywall";

export type SidebarSectionKey = "core" | "planning" | "monetization" | "account";

export type SidebarChildNode = {
  type: "item";
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
  tooltip?: string;
  hideInMinimal?: boolean;
  hideLockBadge?: boolean;
  hideActiveIndicator?: boolean;
  paywallContext?: PaywallContext;
};

export type SidebarGroupNode = {
  type: "group";
  key: string;
  label: string;
  icon: React.ReactNode;
  tooltip?: string;
  hideInMinimal?: boolean;
  paywallContext?: PaywallContext;
  children: SidebarChildNode[];
  autoExpandPaths?: string[];
  statePersistence?: {
    key: string;
    defaultCollapsed: boolean;
  };
};

export type SidebarNode = SidebarChildNode | SidebarGroupNode;

export type SidebarSection = {
  key: SidebarSectionKey;
  title: string;
  description?: string;
  items: SidebarNode[];
};

export type SidebarBuildOptions = {
  hasPremiumAccess: boolean;
  planningLocked: boolean;
  dashboardMinimal: boolean;
};
