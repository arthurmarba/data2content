import {
  HomeIcon as HomeIconOutline,
  MapIcon as MapIconOutline,
  UsersIcon as UsersIconOutline,
  RectangleGroupIcon as RectangleGroupIconOutline,
  SparklesIcon as SparklesIconOutline,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconOutline,
  PresentationChartLineIcon as PresentationChartLineIconOutline,
  CalendarDaysIcon as CalendarDaysIconOutline,
  FilmIcon as FilmIconOutline,
  DocumentTextIcon as DocumentTextIconOutline,
  MagnifyingGlassCircleIcon as MagnifyingGlassCircleIconOutline,
  MegaphoneIcon as MegaphoneIconOutline,
  PlayCircleIcon as PlayCircleIconOutline,
  CalculatorIcon as CalculatorIconOutline,
  UserGroupIcon as UserGroupIconOutline,
  LinkIcon as LinkIconOutline,
  CreditCardIcon as CreditCardIconOutline,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconOutline,
  PencilSquareIcon as PencilSquareIconOutline,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  MapIcon as MapIconSolid,
  UsersIcon as UsersIconSolid,
  RectangleGroupIcon as RectangleGroupIconSolid,
  SparklesIcon as SparklesIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  PresentationChartLineIcon as PresentationChartLineIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  FilmIcon as FilmIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  MagnifyingGlassCircleIcon as MagnifyingGlassCircleIconSolid,
  MegaphoneIcon as MegaphoneIconSolid,
  PlayCircleIcon as PlayCircleIconSolid,
  CalculatorIcon as CalculatorIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  LinkIcon as LinkIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconSolid,
  PencilSquareIcon as PencilSquareIconSolid,
  UserCircleIcon as UserCircleIconSolid,
} from "@heroicons/react/24/solid";
import { navigationLabels } from "@/constants/navigationLabels";
import { MAIN_DASHBOARD_ROUTE, RECORDED_MEETINGS_ROUTE } from "@/constants/routes";
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
  profile: iconSet(UserCircleIconOutline, UserCircleIconSolid),
  dashboard: iconSet(HomeIconOutline, HomeIconSolid),
  meeting: iconSet(CalendarDaysIconOutline, CalendarDaysIconSolid),
  recordedMeetings: iconSet(FilmIconOutline, FilmIconSolid),
  strategicMap: iconSet(MapIconOutline, MapIconSolid),
  collabs: iconSet(UsersIconOutline, UsersIconSolid),
  mediaKit: iconSet(RectangleGroupIconOutline, RectangleGroupIconSolid),
  pro: iconSet(SparklesIconOutline, SparklesIconSolid),
  planningChat: iconSet(ChatBubbleLeftRightIconOutline, ChatBubbleLeftRightIconSolid),
  planningCharts: iconSet(PresentationChartLineIconOutline, PresentationChartLineIconSolid),
  planningCalendar: iconSet(PencilSquareIconOutline, PencilSquareIconSolid),
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
    description: "Seu perfil e visão geral",
    items: [
      {
        type: "item",
        key: "profile",
        label: "Perfil",
        tooltip: "Seu mapa, relatório e acesso à Comunidade D2C",
        href: "/dashboard/profile",
        icon: ICONS.profile,
      },
      {
        type: "item",
        key: "dashboard",
        label: "Visão geral",
        href: MAIN_DASHBOARD_ROUTE,
        icon: ICONS.dashboard,
        exact: true,
      },
      {
        type: "item",
        key: "weekly-meeting",
        label: "Reunião semanal",
        tooltip: "Assista ao vivo toda quinta-feira, às 19h",
        href: "/reuniao",
        icon: ICONS.meeting,
      },
      {
        type: "item",
        key: "recorded-meetings",
        label: "Reuniões gravadas",
        tooltip: "Assista novamente às reuniões exclusivas para assinantes",
        href: RECORDED_MEETINGS_ROUTE,
        icon: ICONS.recordedMeetings,
      },
      {
        type: "item",
        key: "strategic-map",
        label: "Mapa completo",
        tooltip: "Sua narrativa, territórios e assets — o coração do seu conteúdo",
        href: "/dashboard/strategic-map",
        icon: ICONS.strategicMap,
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
    title: "Ferramentas",
    description: "Recursos avançados do desktop",
    items: [
      {
        type: "item",
        key: "collabs",
        label: "Collabs",
        tooltip: "Pautas do seu mapa com criadores compatíveis pra postar junto",
        href: "/dashboard/collabs",
        icon: ICONS.collabs,
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
        key: "calendar.hub",
        label: "Criação de Post",
        tooltip: "Seu planejamento e roteiros em um só lugar",
        href: "/calendar",
        icon: ICONS.planningCalendar,
      },
      {
        type: "item",
        key: "planning.charts",
        label: "Análise de Perfil",
        tooltip: navigationLabels.planningCharts.tooltip,
        href: "/planning/graficos",
        icon: ICONS.planningCharts,
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
    title: "Acesso Comercial",
    description: "Campanhas, parcerias e radar",
    items: [
      {
        type: "item",
        key: "campaigns.overview",
        label: "Campanhas",
        tooltip: "Sua central comercial: CRM, Publis e Calculadora",
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
    title: "Sua Conta",
    description: "Acesso e suporte",
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

// Todos os destinos principais do produto devem permanecer visíveis no painel
// lateral do desktop, inclusive o Mídia Kit.
const DESKTOP_HIDDEN_PANEL_ITEM_KEYS = new Set<string>();

const shouldHideInMinimal = (hideInMinimal: boolean | undefined, dashboardMinimal: boolean) =>
  Boolean(hideInMinimal && dashboardMinimal);
const HIDDEN_SIDEBAR_ITEM_KEYS = new Set<string>([
  "pro",
  "instagram-connection",
  "settings",
  "weekly-meeting",
  "reviews",
  "publis",
  "campaigns.calculator",
  "calendar.hub",
  "planning.charts",
  "planning.discover",
]);

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
    label: options.isMobile && definition.key === "dashboard" ? "Início" : definition.label,
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

export const filterDesktopSidebarSections = (
  sections: SidebarSection[]
): SidebarSection[] =>
  sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !DESKTOP_HIDDEN_PANEL_ITEM_KEYS.has(item.key)
      ),
    }))
    .filter((section) => section.items.length > 0);
