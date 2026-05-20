import type { VideoNarrativeDiagnosisPresentation } from "./videoNarrativeDiagnosisPresentationModel";
import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";
import type { MobileStrategicProfileInput } from "./mobileStrategicProfileMapping";
import { resolveMobileStrategicProfileState } from "./mobileStrategicProfileStateContract";

/**
 * Converte o snapshot estratégico persistido no formato VideoNarrativeDiagnosisPresentation.
 */
export function mapSnapshotToDiagnosisPresentation(
  snapshot: MobileStrategicProfileSnapshotPayload
): VideoNarrativeDiagnosisPresentation {
  return {
    id: "snapshot-diagnosis",
    accessLevel: "free",
    createdAt: new Date().toISOString(),
    hero: {
      title: "Seu Diagnóstico Estratégico",
      subtitle: snapshot.diagnosisSummary || "Análise consolidada da sua narrativa como creator.",
      badge: {
        id: "snapshot-badge",
        label: "Diagnóstico atualizado",
        tone: "neutral",
      },
      levelLabel: "Perfil em evolução",
      nextLevelLabel: "Perfil estratégico",
      precisionLabel: "Leitura de estado",
    },
    priorityCards: [
      {
        id: "snapshot-strong-point",
        title: "Ponto Forte Dominante",
        body: snapshot.recurringPatterns[0] || "Identificado na sua estrutura narrativa.",
        tone: "insight",
        priority: "high",
        locked: false,
      },
      {
        id: "snapshot-opportunity",
        title: "Principal Oportunidade",
        body: snapshot.opportunities[0] || "Território de marca recomendado para você.",
        tone: "opportunity",
        priority: "medium",
        locked: false,
      },
    ],
    sections: [
      {
        id: "video_diagnosis",
        title: "Padrões Narrativos",
        description: "Leitura consolidada dos padrões percebidos no vídeo.",
        visible: true,
        collapsedByDefault: false,
        cards: snapshot.recurringPatterns.map((pattern, idx) => ({
          id: `pattern-${idx}`,
          title: `Padrão Narrativo ${idx + 1}`,
          body: pattern,
          tone: "insight",
          priority: idx === 0 ? "high" : "medium",
          locked: false,
        })),
      },
      {
        id: "brand_opportunities",
        title: "Oportunidades de Marca",
        description: "Territórios possíveis a partir do diagnóstico vivo.",
        visible: true,
        collapsedByDefault: true,
        cards: snapshot.opportunities.map((opportunity, idx) => ({
          id: `opportunity-${idx}`,
          title: `Território Recomendado ${idx + 1}`,
          body: opportunity,
          tone: "opportunity",
          priority: "medium",
          locked: false,
        })),
      },
      {
        id: "creator_evolution",
        title: "Sinais Desbloqueados",
        description: "Aprendizados que já podem orientar o próximo conteúdo.",
        visible: true,
        collapsedByDefault: true,
        cards: snapshot.unlockedSignals.map((signal, idx) => ({
          id: `signal-unlocked-${idx}`,
          title: `Sinal ${idx + 1}`,
          body: signal,
          tone: "action",
          priority: idx === 0 ? "high" : "medium",
          locked: false,
        })),
      },
      {
        id: "next_signals",
        title: "Sinais em Evolução",
        description: "Pontos que ainda precisam de mais contexto para amadurecer.",
        visible: true,
        collapsedByDefault: true,
        cards: snapshot.pendingSignals.map((signal, idx) => ({
          id: `signal-pending-${idx}`,
          title: `Sinal Pendente ${idx + 1}`,
          body: signal,
          tone: "unlock",
          priority: "low",
          locked: true,
        })),
      },
    ],
    lockedPreviews: [],
    primaryCTA: {
      label: "Analisar outro vídeo",
      action: "analyze_another_video",
      helper: "Atualiza o diagnóstico vivo do Perfil.",
    },
    secondaryCTA: null,
    badges: [],
    readingTimeHint: "Leitura rápida",
  };
}

/**
 * Constrói o input inicial do Perfil Estratégico a partir de um snapshot persistido se ele existir.
 */
export function buildMobileStrategicProfileFromSnapshot(params: {
  sessionUser: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    instagramConnected?: boolean;
    instagramUsername?: string | null;
    planStatus?: string | null;
  } | null;
  snapshotPayload: MobileStrategicProfileSnapshotPayload | null;
  accessLevel?: "free" | "premium" | "instagram_optimized" | null;
  profileHref?: string | null;
  analyzeVideoHref?: string | null;
  communityHref?: string | null;
  loginHref?: string | null;
}): MobileStrategicProfileInput {
  const user = params.sessionUser;
  const isAuthenticated = Boolean(user);

  let resolvedBio = "Analise seu primeiro vídeo para começar seu diagnóstico como creator.";
  if (user?.instagramConnected || user?.instagramUsername) {
    resolvedBio = "Seu Perfil Estratégico mostra o que a D2C já entendeu sobre sua narrativa.";
  }

  if (!isAuthenticated || !params.snapshotPayload) {
    // Mantém fallback construction/account_only se não autenticado ou sem snapshot
    const state = resolveMobileStrategicProfileState({
      isAuthenticated,
      userName: user?.name || "Creator",
      userHandle: user?.instagramUsername || null,
      userImage: user?.image || null,
      instagramConnected: user?.instagramConnected || false,
      instagramUsername: user?.instagramUsername || null,
      planStatus: user?.planStatus || "inactive",
      accessLevel: null,
      hasPremiumAccess: false,
      diagnosisPresentation: null,
      hasMediaKit: false,
      mediaKitShareUrl: null,
    });

    return {
      state,
      creatorBio: resolvedBio,
      loginHref: params.loginHref || "/login?intent=strategic_profile",
      profileHref: params.profileHref || "/dashboard/boards/mobile-strategic-profile",
      analyzeVideoHref: params.analyzeVideoHref || "/dashboard/boards/mobile-strategic-profile",
      communityHref: params.communityHref || "/dashboard/community",
    };
  }

  // Com snapshot válido, mapeamos a apresentação do diagnóstico
  const diagnosisPresentation = mapSnapshotToDiagnosisPresentation(params.snapshotPayload);
  const resolvedAccess = params.accessLevel || "free";

  const state = resolveMobileStrategicProfileState({
    isAuthenticated: true,
    userName: user?.name || "Creator",
    userHandle: user?.instagramUsername || null,
    userImage: user?.image || null,
    instagramConnected: user?.instagramConnected || false,
    instagramUsername: user?.instagramUsername || null,
    planStatus: user?.planStatus || "inactive",
    accessLevel: resolvedAccess,
    hasPremiumAccess: resolvedAccess === "premium" || resolvedAccess === "instagram_optimized",
    diagnosisPresentation,
    hasMediaKit: false,
    mediaKitShareUrl: null,
  });

  return {
    state,
    diagnosisPresentation,
    creatorBio: resolvedBio,
    profileHref: params.profileHref || "/dashboard/boards/mobile-strategic-profile",
    analyzeVideoHref: params.analyzeVideoHref || "/dashboard/boards/mobile-strategic-profile",
    communityHref: params.communityHref || "/dashboard/community",
  };
}
