import {
  sanitizeMobileStrategicProfileText,
  type MobileStrategicProfileMediaKitState,
  type MobileStrategicProfilePrimaryIntent,
  type MobileStrategicProfileRecommendedAction,
  type MobileStrategicProfileState,
  type MobileStrategicProfileStatusPill,
} from "./mobileStrategicProfileStateContract";
import type {
  VideoNarrativeDiagnosisPresentation,
  VideoNarrativeDiagnosisPresentationCard,
  VideoNarrativeDiagnosisPresentationSection,
} from "./videoNarrativeDiagnosisPresentationModel";

export interface MobileStrategicProfileInput {
  state: MobileStrategicProfileState;
  diagnosisPresentation?: VideoNarrativeDiagnosisPresentation | null;
  creatorBio?: string | null;
  mediaKitShareUrl?: string | null;
  mediaKitEditUrl?: string | null;
  mediaKitPublicUrl?: string | null;
  communityHref?: string | null;
  profileHref?: string | null;
  analyzeVideoHref?: string | null;
  loginHref?: string | null;
  createdAt?: string | null;
}

export interface MobileStrategicProfileAuthGate {
  visible: boolean;
  title: string;
  description: string;
  action: MobileStrategicProfileAction | null;
}

export interface MobileStrategicProfileIdentity {
  displayName: string;
  displayHandle: string | null;
  userImage: string | null;
  bio: string | null;
}

export interface MobileStrategicProfileHeader {
  title: string;
  subtitle: string;
  identity: MobileStrategicProfileIdentity;
  statusPills: MobileStrategicProfileStatusPill[];
  primaryActionLabel: string | null;
  secondaryActionLabel: string | null;
}

export interface MobileStrategicProfileTab {
  id: "diagnosis" | "commercial";
  label: string;
  active: boolean;
}

export interface MobileStrategicProfileSectionCard {
  id: string;
  title: string;
  body: string;
  tone: "neutral" | "diagnosis" | "commercial" | "action" | "locked";
  source: "state" | "diagnosisPresentation" | "bridge";
  locked: boolean;
}

export interface MobileStrategicProfileSection {
  id: "diagnosis" | "commercial";
  title: string;
  description: string;
  state: "hidden" | "construction" | "ready" | "limited";
  cards: MobileStrategicProfileSectionCard[];
}

export interface MobileStrategicProfileAction {
  id: string;
  intent: MobileStrategicProfilePrimaryIntent | "copy_link" | "view_as_brand" | "edit_or_open_media_kit";
  label: string;
  description: string;
  href: string | null;
  priority: "primary" | "secondary";
  disabled: boolean;
}

export interface MobileStrategicProfileMediaKitBridge {
  state: MobileStrategicProfileMediaKitState | "hidden";
  title: string | null;
  description: string | null;
  href: string | null;
  actions: MobileStrategicProfileAction[];
}

export interface MobileStrategicProfileCommunityBridge {
  visible: boolean;
  label: "Comunidade";
  href: string;
  description: string;
}

export interface MobileStrategicProfileNavigationModel {
  items: Array<{
    id: "profile" | "analyze_video" | "community";
    label: string;
    href: string | null;
    role: "destination" | "central_action";
    active: boolean;
  }>;
}

export interface MobileStrategicProfileConstructionState {
  visible: boolean;
  title: string;
  description: string;
  recommendedActionLabel: string | null;
}

export interface MobileStrategicProfile {
  id: string;
  state: MobileStrategicProfileState;
  authGate: MobileStrategicProfileAuthGate;
  header: MobileStrategicProfileHeader;
  tabs: MobileStrategicProfileTab[];
  activeTab: "diagnosis" | "commercial" | null;
  sections: MobileStrategicProfileSection[];
  primaryActions: MobileStrategicProfileAction[];
  mediaKitBridge: MobileStrategicProfileMediaKitBridge;
  communityBridge: MobileStrategicProfileCommunityBridge;
  navigation: MobileStrategicProfileNavigationModel;
  constructionState: MobileStrategicProfileConstructionState;
  createdAt: string | null;
}

function clean(value: string | null | undefined, fallback = ""): string {
  const sanitized = sanitizeMobileStrategicProfileText(value ?? "");
  return sanitized.trim() || fallback;
}

function sentence(value: string, maxLength = 180): string {
  const sanitized = clean(value).replace(/\s+/g, " ").trim();
  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, maxLength - 1).trim()}…`;
}

function href(value: string | null | undefined): string | null {
  return clean(value) || null;
}

function profileAction(
  params: Omit<MobileStrategicProfileAction, "id" | "label" | "description" | "href"> & {
    id: string;
    label: string;
    description: string;
    href?: string | null;
  },
): MobileStrategicProfileAction {
  return {
    id: clean(params.id),
    intent: params.intent,
    label: sentence(params.label, 72),
    description: sentence(params.description, 150),
    href: href(params.href),
    priority: params.priority,
    disabled: params.disabled,
  };
}

function card(params: {
  id: string;
  title: string;
  body: string;
  tone: MobileStrategicProfileSectionCard["tone"];
  source: MobileStrategicProfileSectionCard["source"];
  locked?: boolean;
}): MobileStrategicProfileSectionCard {
  return {
    id: clean(params.id),
    title: sentence(params.title, 80),
    body: sentence(params.body, 190),
    tone: params.tone,
    source: params.source,
    locked: params.locked ?? false,
  };
}

function mapActionHref(intent: MobileStrategicProfilePrimaryIntent, input: MobileStrategicProfileInput): string | null {
  if (intent === "view_profile") return href(input.profileHref);
  if (intent === "analyze_video") return href(input.analyzeVideoHref);
  if (intent === "connect_instagram") return null;
  if (intent === "share_media_kit") return href(input.mediaKitShareUrl ?? input.mediaKitPublicUrl);
  if (intent === "upgrade") return null;
  return null;
}

function actionFromState(action: MobileStrategicProfileRecommendedAction, input: MobileStrategicProfileInput): MobileStrategicProfileAction {
  return profileAction({
    id: action.id,
    intent: action.intent,
    label: action.label,
    description: action.description,
    href: action.id === "login" ? input.loginHref : mapActionHref(action.intent, input),
    priority: action.priority,
    disabled: action.disabled,
  });
}

function buildAuthGate(input: MobileStrategicProfileInput): MobileStrategicProfileAuthGate {
  const visible = input.state.profileAvailability === "auth_gate";
  if (!visible) {
    return {
      visible: false,
      title: "",
      description: "",
      action: null,
    };
  }

  const loginAction = input.state.recommendedActions[0];
  return {
    visible: true,
    title: sentence(input.state.summary.title),
    description: sentence(input.state.summary.description),
    action: loginAction ? actionFromState(loginAction, input) : null,
  };
}

function buildHeader(input: MobileStrategicProfileInput): MobileStrategicProfileHeader {
  const primaryAction = input.state.recommendedActions.find((item) => item.priority === "primary");
  const secondaryAction = input.state.recommendedActions.find((item) => item.priority === "secondary" && !item.disabled);
  const bio = clean(input.creatorBio) || input.state.summary.helper;

  return {
    title: input.state.profileAvailability === "auth_gate" ? "Perfil Estratégico" : input.state.displayName,
    subtitle: sentence(input.state.summary.description),
    identity: {
      displayName: input.state.displayName,
      displayHandle: input.state.displayHandle,
      userImage: input.state.userImage,
      bio: bio ? sentence(bio, 160) : null,
    },
    statusPills: input.state.statusPills,
    primaryActionLabel: primaryAction?.label ?? null,
    secondaryActionLabel: secondaryAction?.label ?? null,
  };
}

function buildTabs(state: MobileStrategicProfileState): MobileStrategicProfileTab[] {
  if (state.profileAvailability === "auth_gate") return [];

  return [
    { id: "diagnosis", label: "Diagnóstico", active: true },
    { id: "commercial", label: "Comercial", active: false },
  ];
}

function cardFromPresentation(
  cardInput: VideoNarrativeDiagnosisPresentationCard,
  tone: MobileStrategicProfileSectionCard["tone"],
): MobileStrategicProfileSectionCard {
  return card({
    id: cardInput.id,
    title: cardInput.title,
    body: cardInput.body,
    tone,
    source: "diagnosisPresentation",
    locked: cardInput.locked,
  });
}

function sectionCardsFromPresentation(section: VideoNarrativeDiagnosisPresentationSection): MobileStrategicProfileSectionCard[] {
  return section.cards.map((item) => cardFromPresentation(item, section.id.includes("brand") || section.id.includes("collab") ? "commercial" : "diagnosis"));
}

function buildDiagnosisSection(input: MobileStrategicProfileInput): MobileStrategicProfileSection | null {
  const state = input.state;
  const presentation = input.diagnosisPresentation;
  if (state.profileAvailability === "auth_gate") return null;

  if (state.profileAvailability === "construction" || !presentation) {
    return {
      id: "diagnosis",
      title: "Diagnóstico",
      description: "Seu Perfil Estratégico mostra o que a D2C já entendeu sobre sua narrativa.",
      state: "construction",
      cards: [
        card({
          id: "diagnosis-empty",
          title: "Seu Perfil Estratégico começa aqui",
          body: "Analise seu primeiro vídeo para a D2C identificar sua narrativa, ponto forte e próximo passo.",
          tone: "action",
          source: "state",
        }),
      ],
    };
  }

  const cards: MobileStrategicProfileSectionCard[] = [
    card({
      id: "diagnosis-hero",
      title: presentation.hero.title,
      body: presentation.hero.subtitle,
      tone: state.diagnosisState === "instagram_optimized" ? "diagnosis" : "neutral",
      source: "diagnosisPresentation",
    }),
    ...presentation.priorityCards.map((item) => cardFromPresentation(item, "diagnosis")),
    ...presentation.sections
      .filter((section) => section.visible && !section.id.includes("brand") && !section.id.includes("collab") && section.id !== "subscription_unlocks")
      .flatMap(sectionCardsFromPresentation),
  ];

  return {
    id: "diagnosis",
    title: state.diagnosisState === "instagram_optimized" ? "Diagnóstico vivo com leitura mais precisa" : "Diagnóstico vivo",
    description: state.diagnosisState === "complete"
      ? "A D2C conecta suas análises para entender sua narrativa com mais profundidade."
      : "Cada vídeo analisado ajuda a atualizar seu diagnóstico como creator.",
    state: state.diagnosisState === "first_reading" || state.diagnosisState === "limited" ? "limited" : "ready",
    cards,
  };
}

function commercialCardsFromPresentation(presentation: VideoNarrativeDiagnosisPresentation | null | undefined): MobileStrategicProfileSectionCard[] {
  if (!presentation) return [];

  const commercialSections = presentation.sections.filter((section) =>
    section.visible && (section.id === "brand_opportunities" || section.id === "collab_opportunities")
  );

  return commercialSections.flatMap(sectionCardsFromPresentation);
}

function buildCommercialSection(input: MobileStrategicProfileInput): MobileStrategicProfileSection | null {
  const state = input.state;
  if (state.profileAvailability === "auth_gate") return null;

  if (state.profileAvailability === "construction") {
    return {
      id: "commercial",
      title: "Potencial comercial",
      description: "Esta camada fica mais útil depois da primeira análise.",
      state: "limited",
      cards: [
        card({
          id: "commercial-construction",
          title: "Leitura comercial em construção",
          body: "A primeira análise ajuda a entender territórios possíveis e como apresentar seu valor.",
          tone: "commercial",
          source: "state",
        }),
      ],
    };
  }

  const commercialCards = commercialCardsFromPresentation(input.diagnosisPresentation);
  const cards = commercialCards.length > 0
    ? commercialCards
    : [
      card({
        id: "commercial-initial",
        title: "Potencial comercial",
        body: state.diagnosisState === "first_reading" || state.diagnosisState === "limited"
          ? "Uma leitura inicial sobre como sua narrativa pode ser útil para marcas."
          : "Tradução estratégica do diagnóstico para oportunidades futuras.",
        tone: "commercial",
        source: "state",
      }),
    ];

  return {
    id: "commercial",
    title: "Potencial comercial",
    description: state.diagnosisState === "complete" || state.diagnosisState === "instagram_optimized"
      ? "Como sua narrativa pode ser útil para marcas, sem substituir o Mídia Kit."
      : "Essa leitura ajuda você a entender como apresentar seu valor.",
    state: state.diagnosisState === "first_reading" || state.diagnosisState === "limited" ? "limited" : "ready",
    cards,
  };
}

function buildSections(input: MobileStrategicProfileInput): MobileStrategicProfileSection[] {
  return [buildDiagnosisSection(input), buildCommercialSection(input)].filter((section): section is MobileStrategicProfileSection => Boolean(section));
}

function buildMediaKitBridge(input: MobileStrategicProfileInput): MobileStrategicProfileMediaKitBridge {
  const state = input.state.mediaKitState;
  if (input.state.profileAvailability === "auth_gate") {
    return { state: "hidden", title: null, description: null, href: null, actions: [] };
  }

  if (state === "available") {
    const shareHref = href(input.mediaKitShareUrl ?? input.mediaKitPublicUrl);
    return {
      state,
      title: "Mídia Kit",
      description: "Use o Mídia Kit existente para compartilhar seu perfil com marcas.",
      href: shareHref,
      actions: [
        profileAction({
          id: "media-kit-copy-link",
          intent: "copy_link",
          label: "Copiar link",
          description: "Copiar o link do Mídia Kit existente.",
          href: shareHref,
          priority: "secondary",
          disabled: !shareHref,
        }),
        profileAction({
          id: "media-kit-view-brand",
          intent: "view_as_brand",
          label: "Ver como marca",
          description: "Abrir a visão pública existente do Mídia Kit.",
          href: href(input.mediaKitPublicUrl ?? input.mediaKitShareUrl),
          priority: "secondary",
          disabled: !href(input.mediaKitPublicUrl ?? input.mediaKitShareUrl),
        }),
        profileAction({
          id: "media-kit-edit",
          intent: "edit_or_open_media_kit",
          label: "Abrir Mídia Kit",
          description: "Abrir ou editar o recurso existente de Mídia Kit.",
          href: href(input.mediaKitEditUrl ?? input.mediaKitShareUrl),
          priority: "secondary",
          disabled: !href(input.mediaKitEditUrl ?? input.mediaKitShareUrl),
        }),
      ],
    };
  }

  if (state === "connect_instagram_required") {
    return {
      state,
      title: "Mídia Kit",
      description: "Conectar Instagram é o próximo passo para ativar o Mídia Kit existente.",
      href: null,
      actions: [],
    };
  }

  return { state, title: null, description: null, href: null, actions: [] };
}

function buildCommunityBridge(input: MobileStrategicProfileInput): MobileStrategicProfileCommunityBridge {
  return {
    visible: input.state.profileAvailability !== "auth_gate",
    label: "Comunidade",
    href: href(input.communityHref) ?? "/dashboard/community",
    description: "Acesse a Comunidade Data2Content, destino existente para continuar aprendendo com outros membros.",
  };
}

function buildNavigation(input: MobileStrategicProfileInput): MobileStrategicProfileNavigationModel {
  return {
    items: [
      {
        id: "profile",
        label: "Perfil",
        href: href(input.profileHref),
        role: "destination",
        active: true,
      },
      {
        id: "analyze_video",
        label: "+",
        href: href(input.analyzeVideoHref),
        role: "central_action",
        active: false,
      },
      {
        id: "community",
        label: "Comunidade",
        href: href(input.communityHref) ?? "/dashboard/community",
        role: "destination",
        active: false,
      },
    ],
  };
}

function buildConstructionState(input: MobileStrategicProfileInput): MobileStrategicProfileConstructionState {
  const visible = input.state.profileAvailability === "construction";
  return {
    visible,
    title: visible ? "Seu Perfil Estratégico começa aqui" : "",
    description: visible
      ? "Analise seu primeiro vídeo para a D2C identificar sua narrativa, ponto forte e próximo passo."
      : "",
    recommendedActionLabel: visible
      ? input.state.recommendedActions.find((item) => item.intent === "analyze_video")?.label ?? "Analisar primeiro vídeo"
      : null,
  };
}

export function buildMobileStrategicProfile(input: MobileStrategicProfileInput): MobileStrategicProfile {
  const tabs = buildTabs(input.state);
  const primaryActions = input.state.recommendedActions
    .filter((item) => item.id !== "community-future")
    .map((item) => actionFromState(item, input));

  return {
    id: clean(`mobile-strategic-profile-${input.state.authState}-${input.state.profileAvailability}`),
    state: input.state,
    authGate: buildAuthGate(input),
    header: buildHeader(input),
    tabs,
    activeTab: tabs[0]?.id ?? null,
    sections: buildSections(input),
    primaryActions,
    mediaKitBridge: buildMediaKitBridge(input),
    communityBridge: buildCommunityBridge(input),
    navigation: buildNavigation(input),
    constructionState: buildConstructionState(input),
    createdAt: clean(input.createdAt) || input.state.createdAt || input.diagnosisPresentation?.createdAt || null,
  };
}
