import {
  HomeIcon as HomeIconOutline,
  RectangleGroupIcon as RectangleGroupIconOutline,
  SparklesIcon as SparklesIconOutline,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconOutline,
  PresentationChartLineIcon as PresentationChartLineIconOutline,
  CalendarDaysIcon as CalendarDaysIconOutline,
  DocumentTextIcon as DocumentTextIconOutline,
  MagnifyingGlassCircleIcon as MagnifyingGlassCircleIconOutline,
  MegaphoneIcon as MegaphoneIconOutline,
  PlayCircleIcon as PlayCircleIconOutline,
  CalculatorIcon as CalculatorIconOutline,
  UserGroupIcon as UserGroupIconOutline,
  LinkIcon as LinkIconOutline,
  CreditCardIcon as CreditCardIconOutline,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconOutline,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  RectangleGroupIcon as RectangleGroupIconSolid,
  SparklesIcon as SparklesIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  PresentationChartLineIcon as PresentationChartLineIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  MagnifyingGlassCircleIcon as MagnifyingGlassCircleIconSolid,
  MegaphoneIcon as MegaphoneIconSolid,
  PlayCircleIcon as PlayCircleIconSolid,
  CalculatorIcon as CalculatorIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  LinkIcon as LinkIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconSolid,
} from "@heroicons/react/24/solid";
import { navigationLabels } from "@/constants/navigationLabels";
import type { PaywallContext } from "@/types/paywall";
import type {
  SidebarBuildOptions,
  SidebarChildNode,
  SidebarGroupNode,
  SidebarSection,
  SidebarSectionKey,
  SidebarIconComponent,
  SidebarIconSet,
} from "./types";

type PaywallResolver = (options: SidebarBuildOptions) => PaywallContext | undefined;

type SidebarChildDefinition = Omit<SidebarChildNode, "paywallContext"> & {
  paywallResolver?: PaywallResolver;
};

type SidebarGroupDefinition = Omit<SidebarGroupNode, "paywallContext" | "children"> & {
  paywallResolver?: PaywallResolver;
  children: SidebarChildDefinition[];
};

const iconSet = (outline: SidebarIconComponent, solid: SidebarIconComponent): SidebarIconSet => ({
  outline,
  solid,
});

const ICONS = {
  dashboard: iconSet(HomeIconOutline, HomeIconSolid),
  mediaKit: iconSet(RectangleGroupIconOutline, RectangleGroupIconSolid),
  pro: iconSet(SparklesIconOutline, SparklesIconSolid),
  planningChat: iconSet(ChatBubbleLeftRightIconOutline, ChatBubbleLeftRightIconSolid),
  planningCharts: iconSet(PresentationChartLineIconOutline, PresentationChartLineIconSolid),
  planningCalendar: iconSet(CalendarDaysIconOutline, CalendarDaysIconSolid),
  planningScripts: iconSet(DocumentTextIconOutline, DocumentTextIconSolid),
  planningDiscover: iconSet(MagnifyingGlassCircleIconOutline, MagnifyingGlassCircleIconSolid),
  campaigns: iconSet(MegaphoneIconOutline, MegaphoneIconSolid),
  publis: iconSet(PlayCircleIconOutline, PlayCircleIconSolid),
  calculator: iconSet(CalculatorIconOutline, CalculatorIconSolid),
  affiliates: iconSet(UserGroupIconOutline, UserGroupIconSolid),
  instagramConnection: iconSet(LinkIconOutline, LinkIconSolid),
  settings: iconSet(CreditCardIconOutline, CreditCardIconSolid),
  reviews: iconSet(ClipboardDocumentCheckIconOutline, ClipboardDocumentCheckIconSolid),
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
        icon: ICONS.dashboard,
        exact: true,
      },
      {
        type: "item",
        key: "pro",
        label: "Plano Pro",
        tooltip: "Benefícios, preços e fluxos do Plano Pro",
        href: "/pro",
        icon: ICONS.pro,
      },
      {
        type: "item",
        key: "media-kit",
        label: navigationLabels.mediaKit.menu,
        tooltip: navigationLabels.mediaKit.tooltip,
        href: "/media-kit",
        icon: ICONS.mediaKit,
      },
      {
        type: "item",
        key: "reviews",
        label: "Review de Post",
        tooltip: "Veja correções e dicas para seus posts",
        href: "/dashboard/post-analysis",
        icon: ICONS.reviews,
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
        key: "planning.charts",
        label: navigationLabels.planningCharts.menu,
        tooltip: navigationLabels.planningCharts.tooltip,
        href: "/planning/graficos",
        icon: ICONS.planningCharts,
        paywallResolver: ({ planningLocked }) => (planningLocked ? "planning" : undefined),
      },
      {
        type: "item",
        key: "planning.calendar",
        label: navigationLabels.planningPlanner.menu,
        tooltip: navigationLabels.planningPlanner.tooltip,
        href: "/planning/planner",
        icon: ICONS.planningCalendar,
        paywallResolver: ({ planningLocked }) => (planningLocked ? "planning" : undefined),
      },
      {
        type: "item",
        key: "planning.scripts",
        label: navigationLabels.planningScripts.menu,
        tooltip: navigationLabels.planningScripts.tooltip,
        href: "/planning/roteiros",
        icon: ICONS.planningScripts,
        paywallResolver: ({ planningLocked }) => (planningLocked ? "planning" : undefined),
      },
      {
        type: "item",
        key: "planning.discover",
        label: navigationLabels.planningDiscover.menu,
        tooltip: navigationLabels.planningDiscover.tooltip,
        href: "/planning/discover",
        icon: ICONS.planningDiscover,
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
        icon: ICONS.campaigns,
      },
      {
        type: "item",
        key: "publis",
        label: "Minhas Publis",
        tooltip: "Gerencie e compartilhe suas publis",
        href: "/dashboard/publis",
        icon: ICONS.publis,
      },
      {
        type: "item",
        key: "campaigns.calculator",
        label: "Calculadora",
        href: "/dashboard/calculator",
        icon: ICONS.calculator,
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
        icon: ICONS.affiliates,
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
        key: "instagram-connection",
        label: "Conexão",
        tooltip: "Gerencie a conexão com sua conta do Instagram",
        href: "/dashboard/instagram-connection",
        icon: ICONS.instagramConnection,
        hideInMinimal: true,
      },
      {
        type: "item",
        key: "settings",
        label: "Gerir Assinatura",
        tooltip: navigationLabels.settings.tooltip,
        href: "/settings",
        icon: ICONS.settings,
        hideInMinimal: true,
      },
    ],
  },
];

const shouldHideInMinimal = (hideInMinimal: boolean | undefined, dashboardMinimal: boolean) =>
  Boolean(hideInMinimal && dashboardMinimal);
const HIDDEN_SIDEBAR_ITEM_KEYS = new Set<string>(["pro", "instagram-connection", "settings"]);

const resolveChild = (
  definition: SidebarChildDefinition,
  options: SidebarBuildOptions
): SidebarChildNode | null => {
  if (HIDDEN_SIDEBAR_ITEM_KEYS.has(definition.key)) {
    return null;
  }

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
