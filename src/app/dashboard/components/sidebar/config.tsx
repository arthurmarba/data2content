import React from "react";
import { FaHome, FaAddressCard, FaCalendarAlt, FaUsers, FaCreditCard } from "react-icons/fa";
import { Compass as CompassIcon, Calculator, Megaphone, Crown } from "lucide-react";
import { navigationLabels } from "@/constants/navigationLabels";
import type { PaywallContext } from "@/types/paywall";
import type {
  SidebarBuildOptions,
  SidebarChildNode,
  SidebarGroupNode,
  SidebarSection,
  SidebarSectionKey,
} from "./types";

type PaywallResolver = (options: SidebarBuildOptions) => PaywallContext | undefined;

type SidebarChildDefinition = Omit<SidebarChildNode, "paywallContext"> & {
  paywallResolver?: PaywallResolver;
};

type SidebarGroupDefinition = Omit<SidebarGroupNode, "paywallContext" | "children"> & {
  paywallResolver?: PaywallResolver;
  children: SidebarChildDefinition[];
};

type SidebarSectionDefinition = {
  key: SidebarSectionKey;
  title: string;
  description?: string;
  items: Array<SidebarChildDefinition | SidebarGroupDefinition>;
};

const SECTION_DEFINITIONS: SidebarSectionDefinition[] = [
  {
    key: "core",
    title: "Principal",
    description: "Visão geral e vitrine para marcas",
    items: [
      {
        type: "item",
        key: "dashboard",
        label: "Início",
        href: "/dashboard",
        icon: <FaHome />,
        exact: true,
      },
      {
        type: "item",
        key: "media-kit",
        label: navigationLabels.mediaKit.menu,
        tooltip: navigationLabels.mediaKit.tooltip,
        href: "/media-kit",
        icon: <FaAddressCard />,
      },
      {
        type: "item",
        key: "pro",
        label: "Plano PRO",
        tooltip: "Benefícios, preços e fluxos do PRO",
        href: "/pro",
        icon: <Crown className="h-5 w-5 text-brand-magenta" />,
      },
    ],
  },
  {
    key: "planning",
    title: navigationLabels.planning.menu,
    description: navigationLabels.planning.tooltip,
    items: [
      {
        type: "item",
        key: "planning.calendar",
        label: navigationLabels.planningPlanner.menu,
        tooltip: navigationLabels.planningPlanner.tooltip,
        href: "/planning/planner",
        icon: <FaCalendarAlt className="h-5 w-5" />,
        paywallResolver: ({ planningLocked }) => (planningLocked ? "planning" : undefined),
      },
      {
        type: "item",
        key: "planning.discover",
        label: navigationLabels.planningDiscover.menu,
        tooltip: navigationLabels.planningDiscover.tooltip,
        href: "/planning/discover",
        icon: <CompassIcon className="h-5 w-5" />,
        paywallResolver: ({ planningLocked }) => (planningLocked ? "planning" : undefined),
      },
    ],
  },
  {
    key: "monetization",
    title: "Monetização",
    description: "Campanhas, calculadora e afiliados",
    items: [
      {
        type: "item",
        key: "campaigns.overview",
        label: navigationLabels.campaigns.menu,
        tooltip: navigationLabels.campaigns.tooltip,
        href: "/campaigns",
        icon: <Megaphone className="h-5 w-5" />,
      },
      {
        type: "item",
        key: "campaigns.calculator",
        label: "Calculadora",
        href: "/dashboard/calculator",
        icon: <Calculator className="h-5 w-5" />,
        tooltip: "Preço justo a partir das suas métricas",
        hideLockBadge: true,
        paywallResolver: ({ hasPremiumAccess }) => (!hasPremiumAccess ? "calculator" : undefined),
      },
      {
        type: "item",
        key: "affiliates",
        label: navigationLabels.affiliates.menu,
        tooltip: navigationLabels.affiliates.tooltip,
        href: "/affiliates",
        icon: <FaUsers />,
        hideInMinimal: true,
        hideActiveIndicator: true,
      },
    ],
  },
  {
    key: "account",
    title: "Conta",
    description: "Gerencie assinatura e suporte",
    items: [
      {
        type: "item",
        key: "settings",
        label: "Gerir Assinatura",
        tooltip: navigationLabels.settings.tooltip,
        href: "/settings",
        icon: <FaCreditCard />,
        hideInMinimal: true,
      },
    ],
  },
];

const shouldHideInMinimal = (hideInMinimal: boolean | undefined, dashboardMinimal: boolean) =>
  Boolean(hideInMinimal && dashboardMinimal);

const resolveChild = (
  definition: SidebarChildDefinition,
  options: SidebarBuildOptions
): SidebarChildNode | null => {
  if (shouldHideInMinimal(definition.hideInMinimal, options.dashboardMinimal)) {
    return null;
  }

  const paywallContext = definition.paywallResolver?.(options);

  return {
    ...definition,
    paywallContext,
  };
};

const resolveGroup = (
  definition: SidebarGroupDefinition,
  options: SidebarBuildOptions
): SidebarGroupNode | null => {
  if (shouldHideInMinimal(definition.hideInMinimal, options.dashboardMinimal)) {
    return null;
  }

  const children = definition.children
    .map((child) => resolveChild(child, options))
    .filter((child): child is SidebarChildNode => Boolean(child));

  if (!children.length) {
    return null;
  }

  return {
    ...definition,
    children,
    paywallContext: definition.paywallResolver?.(options),
  };
};

export const buildSidebarSections = (options: SidebarBuildOptions): SidebarSection[] =>
  SECTION_DEFINITIONS.map<SidebarSection | null>((section) => {
    const items = section.items
      .map((item) => (item.type === "group" ? resolveGroup(item, options) : resolveChild(item, options)))
      .filter((node): node is SidebarChildNode | SidebarGroupNode => Boolean(node));

    if (!items.length) {
      return null;
    }

    return {
      ...section,
      items,
    };
  }).filter((section): section is SidebarSection => Boolean(section));
