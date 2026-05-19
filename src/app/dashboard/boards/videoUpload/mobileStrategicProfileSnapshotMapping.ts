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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hero: {
      title: "Seu Diagnóstico Estratégico",
      subtitle: snapshot.diagnosisSummary || "Análise consolidada da sua narrativa como creator.",
    },
    priorityCards: [
      {
        id: "snapshot-strong-point",
        title: "Ponto Forte Dominante",
        body: snapshot.recurringPatterns[0] || "Identificado na sua estrutura narrativa.",
        locked: false,
      },
      {
        id: "snapshot-opportunity",
        title: "Principal Oportunidade",
        body: snapshot.opportunities[0] || "Território de marca recomendado para você.",
        locked: false,
      },
    ],
    sections: [
      {
        id: "recurring_patterns",
        title: "Padrões Narrativos",
        visible: true,
        cards: snapshot.recurringPatterns.map((pattern, idx) => ({
          id: `pattern-${idx}`,
          title: `Padrão Narrativo ${idx + 1}`,
          body: pattern,
          locked: false,
        })),
      },
      {
        id: "brand_opportunities",
        title: "Oportunidades de Marca",
        visible: true,
        cards: snapshot.opportunities.map((opportunity, idx) => ({
          id: `opportunity-${idx}`,
          title: `Território Recomendado ${idx + 1}`,
          body: opportunity,
          locked: false,
        })),
      },
      {
        id: "unlocked_signals",
        title: "Sinais Desbloqueados",
        visible: true,
        cards: snapshot.unlockedSignals.map((signal, idx) => ({
          id: `signal-unlocked-${idx}`,
          title: `Sinal ${idx + 1}`,
          body: signal,
          locked: false,
        })),
      },
      {
        id: "pending_signals",
        title: "Sinais em Evolução",
        visible: true,
        cards: snapshot.pendingSignals.map((signal, idx) => ({
          id: `signal-pending-${idx}`,
          title: `Sinal Pendente ${idx + 1}`,
          body: signal,
          locked: true,
        })),
      },
    ],
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
