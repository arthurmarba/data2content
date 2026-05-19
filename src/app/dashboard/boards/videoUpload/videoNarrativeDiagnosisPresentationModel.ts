import type {
  VideoNarrativeAccessTierDiagnosisRules,
  VideoNarrativeAccessTierPrimaryCTAAction,
} from "./videoNarrativeAccessTierDiagnosisRules";
import { sanitizeVideoNarrativeAccessTierDiagnosisRulesText } from "./videoNarrativeAccessTierDiagnosisRules";
import type { VideoNarrativeEvolvingDiagnosis } from "./videoNarrativeEvolvingDiagnosisContract";
import type {
  VideoNarrativeDiagnosisAccessLevel,
  VideoNarrativeStrategicDiagnosis,
} from "./videoNarrativeDiagnosisLearningModel";

export type VideoNarrativeDiagnosisPresentationPriority = "high" | "medium" | "low";

export type VideoNarrativeDiagnosisPresentationTone =
  | "insight"
  | "action"
  | "unlock"
  | "opportunity"
  | "warning";

export interface VideoNarrativeDiagnosisPresentationBadge {
  id: string;
  label: string;
  tone: "neutral" | "success" | "premium" | "instagram" | "warning";
}

export interface VideoNarrativeDiagnosisHeroBlock {
  title: string;
  subtitle: string;
  badge: VideoNarrativeDiagnosisPresentationBadge;
  levelLabel: string;
  nextLevelLabel: string | null;
  precisionLabel: string;
}

export interface VideoNarrativeDiagnosisPresentationCard {
  id: string;
  title: string;
  body: string;
  tone: VideoNarrativeDiagnosisPresentationTone;
  priority: VideoNarrativeDiagnosisPresentationPriority;
  locked: boolean;
}

export type VideoNarrativeDiagnosisPresentationSectionId =
  | "video_diagnosis"
  | "creator_evolution"
  | "strategic_level"
  | "next_signals"
  | "brand_opportunities"
  | "collab_opportunities"
  | "instagram_precision"
  | "subscription_unlocks";

export interface VideoNarrativeDiagnosisPresentationSection {
  id: VideoNarrativeDiagnosisPresentationSectionId;
  title: string;
  description: string;
  cards: VideoNarrativeDiagnosisPresentationCard[];
  collapsedByDefault: boolean;
  visible: boolean;
}

export interface VideoNarrativeDiagnosisPresentationCTA {
  label: string;
  action:
    | VideoNarrativeAccessTierPrimaryCTAAction
    | "connect_instagram_later"
    | "analyze_another_video"
    | "create_script_variation";
  helper: string | null;
}

export interface VideoNarrativeDiagnosisPresentationLockedPreview {
  id: string;
  title: string;
  description: string;
  reason: string;
  ctaLabel: string;
}

export interface VideoNarrativeDiagnosisPresentationInput {
  diagnosis: VideoNarrativeStrategicDiagnosis;
  evolvingDiagnosis: VideoNarrativeEvolvingDiagnosis;
  accessRules: VideoNarrativeAccessTierDiagnosisRules;
}

export interface VideoNarrativeDiagnosisPresentation {
  id: string;
  accessLevel: VideoNarrativeDiagnosisAccessLevel;
  hero: VideoNarrativeDiagnosisHeroBlock;
  priorityCards: VideoNarrativeDiagnosisPresentationCard[];
  sections: VideoNarrativeDiagnosisPresentationSection[];
  lockedPreviews: VideoNarrativeDiagnosisPresentationLockedPreview[];
  primaryCTA: VideoNarrativeDiagnosisPresentationCTA;
  secondaryCTA: VideoNarrativeDiagnosisPresentationCTA | null;
  badges: VideoNarrativeDiagnosisPresentationBadge[];
  readingTimeHint: string;
  createdAt: string | null;
}

function clean(value: string | null | undefined): string {
  return sanitizeVideoNarrativeDiagnosisPresentationText(value ?? "");
}

function firstText(values: Array<string | null | undefined>, fallback: string): string {
  return clean(values.find((value) => value?.trim()) ?? fallback);
}

function sentence(value: string, maxLength = 150): string {
  const sanitized = clean(value).replace(/\s+/g, " ").trim();
  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, maxLength - 1).trim()}…`;
}

function card(params: {
  id: string;
  title: string;
  body: string;
  tone: VideoNarrativeDiagnosisPresentationTone;
  priority: VideoNarrativeDiagnosisPresentationPriority;
  locked?: boolean;
}): VideoNarrativeDiagnosisPresentationCard {
  return {
    id: clean(params.id),
    title: sentence(params.title, 72),
    body: sentence(params.body, 170),
    tone: params.tone,
    priority: params.priority,
    locked: params.locked ?? false,
  };
}

function badge(
  id: string,
  label: string,
  tone: VideoNarrativeDiagnosisPresentationBadge["tone"],
): VideoNarrativeDiagnosisPresentationBadge {
  return { id: clean(id), label: sentence(label, 48), tone };
}

function section(params: {
  id: VideoNarrativeDiagnosisPresentationSectionId;
  title: string;
  description: string;
  cards: VideoNarrativeDiagnosisPresentationCard[];
  collapsedByDefault?: boolean;
  visible?: boolean;
}): VideoNarrativeDiagnosisPresentationSection {
  return {
    id: params.id,
    title: sentence(params.title, 80),
    description: sentence(params.description, 150),
    cards: params.cards,
    collapsedByDefault: params.collapsedByDefault ?? true,
    visible: params.visible ?? true,
  };
}

function buildHero(input: VideoNarrativeDiagnosisPresentationInput): VideoNarrativeDiagnosisHeroBlock {
  const accessLevel = input.accessRules.accessLevel;
  const levelLabel = input.evolvingDiagnosis.currentLevel.label;
  const nextLevelLabel = input.evolvingDiagnosis.nextLevel?.label ?? null;

  if (accessLevel === "instagram_optimized" && input.accessRules.canShowInstagramPrecision) {
    return {
      title: "Diagnóstico otimizado com contexto de Instagram",
      subtitle: sentence("A leitura combina o mapa estratégico com contexto futuro de Instagram nesta simulação."),
      badge: badge("instagram-precision", "Leitura mais precisa", "instagram"),
      levelLabel,
      nextLevelLabel,
      precisionLabel: "Contexto futuro de Instagram disponível nesta simulação",
    };
  }

  if (accessLevel === "premium") {
    return {
      title: "Seu mapa estratégico foi atualizado",
      subtitle: sentence("O diagnóstico conecta este vídeo aos sinais do creator e aos próximos movimentos."),
      badge: badge("premium-complete", "Diagnóstico completo", "premium"),
      levelLabel,
      nextLevelLabel,
      precisionLabel: "Mapa estratégico baseado nos sinais do creator",
    };
  }

  return {
    title: "Primeira leitura do seu vídeo",
    subtitle: sentence("Sua primeira leitura já mostra direção, ajuste e um sinal inicial do mapa do creator."),
    badge: badge("free-first-reading", "Primeira leitura gratuita", "neutral"),
    levelLabel,
    nextLevelLabel,
    precisionLabel: "Leitura inicial, sem performance do Instagram",
  };
}

function buildPriorityCards(input: VideoNarrativeDiagnosisPresentationInput): VideoNarrativeDiagnosisPresentationCard[] {
  const diagnosis = input.diagnosis;
  const evolving = input.evolvingDiagnosis;
  const cards = [
    card({
      id: "main-reading",
      title: "O que este vídeo comunica",
      body: `Este vídeo comunica ${firstText([diagnosis.whatVideoCommunicates, diagnosis.mainNarrative], "uma direção narrativa em construção")}.`,
      tone: "insight",
      priority: "high",
    }),
    card({
      id: "primary-adjustment",
      title: "Ajuste mais importante",
      body: `O ajuste mais importante é ${firstText([diagnosis.recommendedAdjustment, diagnosis.weakness], "deixar a abertura mais clara")}.`,
      tone: "action",
      priority: "high",
    }),
    card({
      id: "creator-reveal",
      title: "O que revelou sobre o creator",
      body: firstText([
        evolving.unlockedSignals[0]?.label,
        evolving.profileImpact.summary,
      ], "Este vídeo revelou um primeiro sinal para o mapa estratégico."),
      tone: "insight",
      priority: "high",
    }),
    card({
      id: "next-move",
      title: "Próximo movimento",
      body: firstText([
        evolving.nextSignalsToUnlock[0]?.action,
        input.accessRules.primaryCTA.helper,
      ], "O próximo movimento é transformar a leitura em direção prática."),
      tone: "action",
      priority: "high",
    }),
  ];

  const opportunity = input.accessRules.commercialAvailability.hasSignals
    ? input.evolvingDiagnosis.opportunities.find((item) => item.type === "brand_territory")
    : input.evolvingDiagnosis.opportunities.find((item) => item.type === "collab_type");

  if (opportunity) {
    cards.push(card({
      id: "future-opportunity",
      title: opportunity.type === "brand_territory" ? "Oportunidade futura de marca" : "Oportunidade futura de collab",
      body: opportunity.label,
      tone: "opportunity",
      priority: "medium",
      locked: input.accessRules.accessLevel === "free",
    }));
  }

  return cards.slice(0, 5);
}

function buildSections(input: VideoNarrativeDiagnosisPresentationInput): VideoNarrativeDiagnosisPresentationSection[] {
  const diagnosis = input.diagnosis;
  const evolving = input.evolvingDiagnosis;
  const rules = input.accessRules;

  const sections: VideoNarrativeDiagnosisPresentationSection[] = [
    section({
      id: "video_diagnosis",
      title: "Diagnóstico do vídeo",
      description: "A leitura prática do vídeo, com narrativa, ajuste e gancho.",
      collapsedByDefault: false,
      cards: [
        card({ id: "video-main", title: "Narrativa", body: firstText([diagnosis.mainNarrative], "Narrativa em construção."), tone: "insight", priority: "high" }),
        card({ id: "video-hook", title: "Gancho", body: firstText([diagnosis.suggestedHook], "A abertura pode ficar mais clara."), tone: "action", priority: "medium" }),
      ],
    }),
    section({
      id: "creator_evolution",
      title: "Evolução do creator",
      description: "Como este vídeo alimenta o mapa estratégico.",
      visible: rules.canShowFullProfileImpact || rules.accessLevel === "free",
      cards: [
        card({ id: "profile-impact", title: "Impacto no perfil", body: evolving.profileImpact.summary, tone: "insight", priority: "high", locked: !rules.canShowFullProfileImpact }),
        ...evolving.unlockedSignals.slice(0, rules.accessLevel === "free" ? 1 : 4).map((signal, index) =>
          card({ id: `unlocked-signal-${index}`, title: "Sinal revelado", body: signal.label, tone: "insight", priority: "medium" }),
        ),
      ],
    }),
    section({
      id: "strategic_level",
      title: "Nível estratégico",
      description: "Onde o creator está no mapa e qual é o próximo nível.",
      visible: rules.canShowFullProfileImpact,
      cards: [
        card({ id: "current-level", title: evolving.currentLevel.label, body: evolving.currentLevel.description, tone: "insight", priority: "medium" }),
        card({ id: "next-level", title: "Próximo nível", body: evolving.nextLevel?.description ?? "O mapa estratégico já está em estágio avançado.", tone: "action", priority: "medium" }),
      ],
    }),
    section({
      id: "next_signals",
      title: "Próximos sinais",
      description: "O que a D2C ainda precisa entender para melhorar a leitura.",
      visible: rules.accessLevel !== "free",
      cards: evolving.nextSignalsToUnlock.slice(0, 4).map((item, index) =>
        card({ id: `next-signal-${index}`, title: item.label, body: item.action, tone: "action", priority: "medium" }),
      ),
    }),
    section({
      id: "brand_opportunities",
      title: "Oportunidades futuras de marca",
      description: "Territórios possíveis e fit narrativo como oportunidade futura.",
      visible: rules.canShowFullBrandOpportunities || (rules.accessLevel === "free" && rules.commercialAvailability.hasSignals),
      cards: [
        card({
          id: "brand-availability",
          title: rules.commercialAvailability.label,
          body: safeAvailabilityDescription("brand", rules.commercialAvailability.state),
          tone: "opportunity",
          priority: "medium",
          locked: !rules.canShowFullBrandOpportunities,
        }),
      ],
    }),
    section({
      id: "collab_opportunities",
      title: "Tipos de collab futuros",
      description: "Caminhos de colaboração possíveis por tipo de oportunidade futura.",
      visible: rules.canShowFullCollabOpportunities || (rules.accessLevel === "free" && rules.collabAvailability.hasSignals),
      cards: [
        card({
          id: "collab-availability",
          title: rules.collabAvailability.label,
          body: safeAvailabilityDescription("collab", rules.collabAvailability.state),
          tone: "opportunity",
          priority: "medium",
          locked: !rules.canShowFullCollabOpportunities,
        }),
      ],
    }),
    section({
      id: "instagram_precision",
      title: "Precisão com Instagram",
      description: "Como o contexto futuro de Instagram deixa a leitura mais precisa.",
      visible: rules.canShowInstagramPrecision,
      cards: [
        card({
          id: "instagram-context",
          title: "Leitura mais precisa",
          body: "Com Instagram, essa leitura fica mais precisa por contexto futuro de perfil e performance.",
          tone: "insight",
          priority: "high",
        }),
      ],
    }),
    section({
      id: "subscription_unlocks",
      title: "O que desbloqueia",
      description: "Previews elegantes do que fica disponível em camadas mais profundas.",
      visible: rules.lockedSections.length > 0,
      cards: rules.lockedSections.slice(0, 4).map((locked, index) =>
        card({ id: `locked-section-${index}`, title: locked.label, body: locked.message, tone: "unlock", priority: "low", locked: true }),
      ),
    }),
  ];

  return sections.filter((item) => item.visible);
}

function buildLockedPreviews(input: VideoNarrativeDiagnosisPresentationInput): VideoNarrativeDiagnosisPresentationLockedPreview[] {
  return input.accessRules.lockedSections.map((locked) => ({
    id: clean(`locked-${locked.key}`),
    title: sentence(locked.label, 80),
    description: sentence(`${lockedPreviewDescription(locked.key)} Sua primeira leitura já ajuda, mas a D2C fica mais estratégica com mais contexto.`, 190),
    reason: sentence(lockedPreviewReason(locked.key), 150),
    ctaLabel: input.accessRules.accessLevel === "free" ? "Desbloquear diagnóstico completo" : "Conectar Instagram",
  }));
}

function buildPrimaryCTA(accessRules: VideoNarrativeAccessTierDiagnosisRules): VideoNarrativeDiagnosisPresentationCTA {
  return {
    label: sentence(accessRules.primaryCTA.label, 64),
    action: accessRules.primaryCTA.action,
    helper: sentence(accessRules.primaryCTA.helper, 120),
  };
}

function buildSecondaryCTA(accessRules: VideoNarrativeAccessTierDiagnosisRules): VideoNarrativeDiagnosisPresentationCTA | null {
  if (accessRules.accessLevel === "free") {
    return {
      label: "Conectar Instagram depois",
      action: "connect_instagram_later",
      helper: "Você pode manter a primeira leitura e adicionar contexto depois.",
    };
  }

  if (accessRules.accessLevel === "premium" && accessRules.shouldTeaseInstagramConnection) {
    return {
      label: "Analisar mais um vídeo",
      action: "analyze_another_video",
      helper: "Mais vídeos ajudam a fortalecer o mapa estratégico.",
    };
  }

  if (accessRules.accessLevel === "instagram_optimized" && accessRules.canShowInstagramPrecision) {
    return {
      label: "Criar variação de roteiro",
      action: "create_script_variation",
      helper: "Transforme a leitura em uma nova direção de execução.",
    };
  }

  return null;
}

function buildBadges(input: VideoNarrativeDiagnosisPresentationInput & {
  heroPrecisionLabel: string;
}): VideoNarrativeDiagnosisPresentationBadge[] {
  const badges = [
    input.accessRules.accessLevel === "free"
      ? badge("access-free", "Free", "neutral")
      : input.accessRules.accessLevel === "premium"
        ? badge("access-premium", "Premium", "premium")
        : badge("access-instagram", "Instagram optimized", "instagram"),
    badge("current-level", input.evolvingDiagnosis.currentLevel.label, "neutral"),
    badge("precision", input.heroPrecisionLabel, "neutral"),
  ];

  if (input.accessRules.commercialAvailability.hasSignals) {
    badges.push(badge("brand-availability", "Território de marca possível", "success"));
  }
  if (input.accessRules.collabAvailability.hasSignals) {
    badges.push(badge("collab-availability", "Tipo de collab futuro", "success"));
  }

  return badges.filter((item) => item.label);
}

function readingTimeHint(accessLevel: VideoNarrativeDiagnosisAccessLevel): string {
  if (accessLevel === "free") return "Leitura rápida: 30 segundos";
  if (accessLevel === "premium") return "Leitura estratégica: 2 minutos";
  return "Leitura completa: 2 a 3 minutos";
}

export function sanitizeVideoNarrativeDiagnosisPresentationText(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/viralizar garantido/gi, "crescer com consistência"],
    [/patroc[ií]nio garantido/gi, "oportunidade futura"],
    [/marca garantida/gi, "território possível"],
    [/publi garantida/gi, "possibilidade comercial"],
    [/match real/gi, "indicação futura"],
    [/match comprovado/gi, "fit narrativo"],
    [/resultado garantido/gi, "próximo movimento"],
    [/\bviralizar\b/gi, "crescer com consistência"],
    [/\bscore\b/gi, "leitura"],
    [/\bnota\b/gi, "leitura"],
    [/\bpontos\b/gi, "sinais"],
    [/\branking\b/gi, "mapa"],
    [/\bgabarito\b/gi, "direção"],
    [/\bgarantido\b/gi, "possível"],
    [/\bcerteza\b/gi, "leitura"],
    [/\bcomprovado\b/gi, "observado"],
  ];

  return replacements.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    sanitizeVideoNarrativeAccessTierDiagnosisRulesText(value),
  );
}

function safeAvailabilityDescription(
  kind: "brand" | "collab",
  state: "teaser_only" | "strategic_available" | "instagram_precision_available" | "unavailable",
): string {
  if (kind === "brand") {
    if (state === "unavailable") return "A D2C ainda precisa entender melhor o território de marca possível.";
    if (state === "teaser_only") return "Existe indício de território de marca possível, ainda em formato de teaser.";
    if (state === "instagram_precision_available") {
      return "Território de marca possível com contexto futuro de Instagram para leitura mais precisa.";
    }
    return "Oportunidade futura de marca por território e fit narrativo.";
  }

  if (state === "unavailable") return "A D2C ainda precisa entender melhor o tipo de collab futuro.";
  if (state === "teaser_only") return "Existe indício de tipo de collab futuro, ainda em formato de teaser.";
  if (state === "instagram_precision_available") {
    return "Tipo de collab futuro com contexto futuro de Instagram para leitura mais precisa.";
  }
  return "Tipos de collab possíveis por formato, autoridade e ponte de audiência.";
}

function lockedPreviewDescription(key: string): string {
  if (key === "brand_opportunities") return "Mostra territórios de marca possíveis e fit narrativo com mais profundidade.";
  if (key === "collab_opportunities") return "Organiza tipos de collab futuros sem sugerir creators reais.";
  if (key === "instagram_precision" || key === "performance_comparison") {
    return "Adiciona contexto futuro de Instagram para deixar a leitura mais precisa.";
  }
  if (key === "full_profile_impact") return "Mostra o mapa estratégico completo e o impacto do vídeo no creator.";
  if (key === "recurring_patterns") return "Mostra padrões recorrentes mais profundos entre vídeos.";
  return "Aprofunda esta parte do diagnóstico em uma camada mais estratégica.";
}

function lockedPreviewReason(key: string): string {
  if (key === "instagram_precision" || key === "performance_comparison") {
    return "Precisa de conexão futura de Instagram para adicionar contexto de precisão.";
  }
  return "Disponível em uma camada mais completa do diagnóstico.";
}

export function buildVideoNarrativeDiagnosisPresentation(
  input: VideoNarrativeDiagnosisPresentationInput,
): VideoNarrativeDiagnosisPresentation {
  const hero = buildHero(input);
  const presentationInput = { ...input, heroPrecisionLabel: hero.precisionLabel } as VideoNarrativeDiagnosisPresentationInput & {
    heroPrecisionLabel: string;
  };

  return {
    id: clean(`diagnosis-presentation-${input.evolvingDiagnosis.id}`),
    accessLevel: input.accessRules.accessLevel,
    hero,
    priorityCards: buildPriorityCards(input),
    sections: buildSections(input),
    lockedPreviews: buildLockedPreviews(input),
    primaryCTA: buildPrimaryCTA(input.accessRules),
    secondaryCTA: buildSecondaryCTA(input.accessRules),
    badges: buildBadges(presentationInput),
    readingTimeHint: readingTimeHint(input.accessRules.accessLevel),
    createdAt: input.evolvingDiagnosis.createdAt ?? input.diagnosis.createdAt ?? null,
  };
}
