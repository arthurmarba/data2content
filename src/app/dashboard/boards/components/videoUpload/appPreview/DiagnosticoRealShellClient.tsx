"use client";

import { useCallback, useEffect, useMemo, useRef, startTransition, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import type {
  DiagnosticoCollabSuggestionsState,
  DiagnosticoCreatorDirectoryState,
  DiagnosticoPageData,
} from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { resolveDiagnosticoLeadingNarrativeSignal } from "@/app/dashboard/boards/videoUpload/diagnosticoNarrativeSignals";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";
import { COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";
import { openPaywallModal } from "@/utils/paywallModal";
import { startInstagramReconnect } from "@/app/lib/instagram/client/startInstagramReconnect";
import {
  MOBILE_INSTAGRAM_CONNECT_ROUTE,
  MOBILE_MEDIA_KIT_ROUTE,
  MOBILE_PROFILE_ROUTE,
  MOBILE_WHATSAPP_CONNECT_ROUTE,
} from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { requestUploadSession } from "./mobileStrategicProfileUploadSessionClient";
import { uploadVideoToTemporarySignedUrl } from "./mobileStrategicProfileDirectUploadClient";
import { postMobileStrategicProfileAnalysisJson } from "./mobileStrategicProfileAnalysisSubmitClient";
import {
  MobileStrategicProfileAnalyzeFlow,
  type MobileStrategicProfileAnalyzeResult,
  type MobileStrategicProfileAnalyzeFlowCompleteResult,
} from "./MobileStrategicProfileAnalyzeFlow";
import {
  MobileCalculatorWizard,
  type MobileCalculatorResult,
} from "./MobileCalculatorWizard";
import { fetchAnalysisConfirmationDataFromReading } from "./mobileStrategicProfileAnalysisConfirmationClient";
import { DiagnosticoPage } from "./DiagnosticoPage";
import { DiagnosticoTabBar, type DiagnosticoTab } from "./DiagnosticoTabBar";
import {
  DiagnosticoCollabsFeed,
  type CollabsBootstrapStatus,
  type PautaActionKind,
  type PautaActionState,
} from "./DiagnosticoCollabsFeed";
import type { CollabStackDecision } from "./DiagnosticoCollabStack";
import { DiagnosticoCollabMatchOverlay } from "./DiagnosticoCollabMatchOverlay";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import { ReadingDetailView } from "./ReadingDetailView";
import { useReadingDetail } from "./useReadingDetail";
import type { CategoryId } from "./DiagnosticoCategoryMeta";
import { DiagnosticoNarrativeDetailView } from "./DiagnosticoNarrativeDetailView";
import { MobileOnboardingFlow, type OnboardingStep } from "./MobileOnboardingFlow";
import type {
  ConfirmationState,
  ConfirmationResponse,
  AssetConfirmationResponse,
} from "./diagnosticoConfirmationTypes";
import { DiagnosticoStrategicDetailView } from "./DiagnosticoStrategicDetailView";
import { DiagnosticoExecutionDetailView } from "./DiagnosticoExecutionDetailView";
import { DiagnosticoInstagramDetailView } from "./DiagnosticoInstagramDetailView";
import { DiagnosticoBrandsDetailView } from "./DiagnosticoBrandsDetailView";
import { DiagnosticoCollabsDetailView } from "./DiagnosticoCollabsDetailView";
import { DiagnosticoCommunityDetailView } from "./DiagnosticoCommunityDetailView";
import { DiagnosticoReadingsDetailView } from "./DiagnosticoReadingsDetailView";
import { DiagnosticoIdeasDetailView } from "./DiagnosticoIdeasDetailView";
import { DiagnosticoAccountMenuSheet } from "./DiagnosticoAccountMenuSheet";
import { DiagnosticoNorteView } from "./DiagnosticoNorteView";
import { DiagnosticoWhatsAppSheet } from "./DiagnosticoWhatsAppSheet";
import { DiagnosticoIdeaDetailSheet } from "./DiagnosticoIdeaDetailSheet";
import { DiagnosticoOverviewDetailView } from "./DiagnosticoOverviewDetailView";
import { MediaKitSheet } from "./MediaKitSheet";
import { getNarrativeMapAccessAction } from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import { trackMobileNarrativeEvent, type MobileNarrativeTelemetryEventName } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";
import {
  contentIdeaLocalDecisionStorageKey,
  forgetContentIdeaLocalDecision,
  readContentIdeaLocalDecisions,
  rememberContentIdeaLocalDecision,
} from "@/app/dashboard/boards/videoUpload/contentIdeaLocalDecisions";
import SurveyModal from "@/app/dashboard/home/minimal/SurveyModal";

const REAL_ANALYSIS_ENABLED =
  process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED === "1";

interface Props {
  data: DiagnosticoPageData;
  onAnalyzeAction: null;
}

type MobileCollabSuggestionsPayload = {
  narrativeLabel: string | null;
  collabTerritories: Array<{ label: string; summary?: string | null }>;
  commercialTerritories: Array<{ label: string; summary?: string | null }>;
  periodDays: number;
  limit: number;
};

function cleanSignalText(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, " ").trim() || "";
  return text.length >= 3 ? text : null;
}

function firstSignalLabel(
  values: Array<{ label?: string | null; summary?: string | null } | null | undefined>,
) {
  for (const value of values) {
    const label = cleanSignalText(value?.label);
    if (label) return label;
    const summary = cleanSignalText(value?.summary);
    if (summary) return summary;
  }
  return null;
}

function buildMobileCollabSuggestionsPayload(data: DiagnosticoPageData): MobileCollabSuggestionsPayload | null {
  const s = data.synthesis;
  const narrativeLabel =
    cleanSignalText(data.mainNarrativeLabel || s.mainNarrative?.label) ||
    firstSignalLabel([
      s.testedNarratives[0],
      s.recurringPatterns[0],
      s.strengths[0],
      s.recurringTensions[0],
    ]) ||
    cleanSignalText(s.nextStrategicMove?.label) ||
    cleanSignalText(data.readings[0]?.rememberedAs);
  const collabTerritories = data.synthesis.collabTerritories
    .map((territory) => ({
      label: cleanSignalText(territory.label) || "",
      summary: cleanSignalText(territory.summary),
    }))
    .filter((territory) => territory.label);
  const commercialTerritories = data.synthesis.commercialTerritories
    .map((territory) => ({
      label: cleanSignalText(territory.label) || "",
      summary: cleanSignalText(territory.summary),
    }))
    .filter((territory) => territory.label);

  if (!narrativeLabel && collabTerritories.length === 0 && commercialTerritories.length === 0) {
    const hasAnyReadingSignal = data.readings.length > 0 || data.synthesis.analyzedReadingsCount > 0;
    if (!hasAnyReadingSignal) return null;
  }

  return {
    narrativeLabel,
    collabTerritories,
    commercialTerritories,
    periodDays: 180,
    limit: 3,
  };
}

export function DiagnosticoRealShellClient({ data }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [analyzeFlowOpen, setAnalyzeFlowOpen] = useState(false);
  // Aba ativa da tab bar mobile (Perfil/Collabs). "+" não é aba — abre o upload.
  // Default "perfil": usuário novo/sem mapa cai no Perfil.
  const [activeTab, setActiveTab] = useState<DiagnosticoTab>("perfil");
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [localThumbnails, setLocalThumbnails] = useState<Record<string, string>>({});
  const [showInstagramConnectedNotice, setShowInstagramConnectedNotice] = useState(false);
  // True quando a página foi carregada após a conexão do Instagram (via ?instagramLinked=true).
  // Usado para mostrar estado "processando" no card de pautas enquanto o enriquecimento
  // assíncrono ainda não terminou. Inicializa do URL para capturar o hard-reload.
  const [instagramJustLinked] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("instagramLinked") === "true",
  );
  const [openCategory, setOpenCategory] = useState<CategoryId | null>(null);
  const pendingPublishIntentRef = useRef<Promise<void> | null>(null);
  const [diagnosisOverviewOpen, setDiagnosisOverviewOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [norteOpen, setNorteOpen] = useState(false);
  // Propósito local — reflete saves em DiagnosticoNorteView sem router.refresh().
  const [localPurpose, setLocalPurpose] = useState<string | null>(
    data.onboardingAnswers?.creatorPurpose ?? null,
  );
  // Sincroniza o state quando o servidor retorna dados novos (ex.: router.refresh()
  // pós-onboarding). useState não reinicializa em re-renders, então o propósito
  // salvo no Q3 do onboarding só aparecia depois de recarregar a página.
  useEffect(() => {
    setLocalPurpose(data.onboardingAnswers?.creatorPurpose ?? null);
  }, [data.onboardingAnswers?.creatorPurpose]);
  const [whatsAppSheetOpen, setWhatsAppSheetOpen] = useState(false);
  const [calculatorWizardOpen, setCalculatorWizardOpen] = useState(false);
  const [latestCalculation, setLatestCalculation] = useState<MobileCalculatorResult | null>(null);
  const [openIdeaId, setOpenIdeaId] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(data.needsOnboarding);
  // O3: step de retomada após conectar Instagram durante o onboarding.
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<OnboardingStep | null>(null);
  const [collabSuggestions, setCollabSuggestions] = useState<DiagnosticoCollabSuggestionsState>({
    status: "idle",
    items: [],
    error: null,
  });

  // ── Auto-geração de pautas ────────────────────────────────────────────────────
  // localContentIdeas é a fonte de verdade no cliente.
  // Inicializa com o que o servidor enviou; é atualizado diretamente da resposta
  // da API de geração — sem depender de router.refresh() para mostrar os chips.
  const [localContentIdeas, setLocalContentIdeas] = useState<DiagnosticoPageData["contentIdeas"]>(
    data.contentIdeas,
  );
  const localPautaDecisionStorageKey = useMemo(
    () => contentIdeaLocalDecisionStorageKey(data.userInfo.email ?? data.userInfo.handle),
    [data.userInfo.email, data.userInfo.handle],
  );
  const serverContentIdeasSignature = data.contentIdeas
    .map((idea) => `${idea.id}:${idea.status}:${idea.title}:${idea.hook ?? ""}`)
    .join("|");
  useEffect(() => {
    setLocalContentIdeas(data.contentIdeas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverContentIdeasSignature]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [ideaGenerationBlocker, setIdeaGenerationBlocker] = useState<
    "premium_required" | "quota_exceeded" | "map_incomplete" | "failed" | null
  >(null);
  const [ideaQuotaResetAt, setIdeaQuotaResetAt] = useState<string | null>(null);
  const autoGenerateTriggeredRef = useRef(false);
  const generatingRef = useRef(false); // mutex — prevents concurrent calls
  const [creatorDirectory, setCreatorDirectory] = useState<DiagnosticoCreatorDirectoryState>({
    status: "idle",
    creators: [],
    error: null,
  });

  // ── Narrative map confirmation state ─────────────────────────────────────────
  // Initialised from server-loaded mapConfirmations (null → default "pending").
  const [narrativeConfirmationState, setNarrativeConfirmationState] =
    useState<ConfirmationState>(data.mapConfirmations?.narrative ?? "pending");
  const [territoriesConfirmationState, setTerritoriesConfirmationState] =
    useState<ConfirmationState>(data.mapConfirmations?.territories ?? "pending");
  const [toneConfirmationState, setToneConfirmationState] =
    useState<ConfirmationState>(data.mapConfirmations?.tone ?? "pending");
  const [assetConfirmations, setAssetConfirmations] = useState<Map<string, "confirmed" | "dismissed">>(
    () => {
      const map = new Map<string, "confirmed" | "dismissed">();
      for (const a of data.mapConfirmations?.assetConfirmations ?? []) {
        if (a.state === "confirmed" || a.state === "dismissed") {
          map.set(a.label, a.state);
        }
      }
      return map;
    },
  );
  const localMapConfirmations = useMemo(() => {
    const base = data.mapConfirmations ?? {
      narrative: "pending" as const,
      territories: "pending" as const,
      tone: "pending" as const,
      assetConfirmations: [],
      endorsedHypotheses: [],
      dismissedHypotheses: [],
      confirmedFormats: [],
      adjacentNarratives: [],
    };
    const mergedAssetConfirmations = [...base.assetConfirmations];
    for (const [label, state] of assetConfirmations.entries()) {
      const index = mergedAssetConfirmations.findIndex((asset) => asset.label === label);
      if (index >= 0) {
        mergedAssetConfirmations[index] = { label, state };
      } else {
        mergedAssetConfirmations.push({ label, state });
      }
    }
    return {
      ...base,
      narrative: narrativeConfirmationState,
      territories: territoriesConfirmationState,
      tone: toneConfirmationState,
      assetConfirmations: mergedAssetConfirmations,
      // adjacentNarratives are managed locally in MapaCard; pass server state as seed
      adjacentNarratives: base.adjacentNarratives ?? [],
    };
  }, [
    data.mapConfirmations,
    narrativeConfirmationState,
    territoriesConfirmationState,
    toneConfirmationState,
    assetConfirmations,
  ]);
  const isMapReadyForExpansion =
    data.synthesis.status !== "empty" &&
    data.synthesis.analyzedReadingsCount > 0 &&
    localMapConfirmations.narrative === "confirmed" &&
    localMapConfirmations.territories === "confirmed";
  const [mediaKitSheetSlug, setMediaKitSheetSlug] = useState<string | null>(null);

  // A entrada em Collabs é uma transação visual: sugestões por pauta, decisões
  // anteriores, matches confirmados e decisões locais precisam chegar ANTES de
  // qualquer card real aparecer. Expor cada fonte separadamente fazia o mesmo
  // espaço trocar de pauta → collab → match, parecendo um bug.
  const [pautaCollabs, setPautaCollabs] = useState<Map<string, NarrativeCollabMatch | null>>(new Map());
  const [collabDecisions, setCollabDecisions] = useState<Map<string, CollabStackDecision>>(new Map());
  const [pautaActionStates, setPautaActionStates] = useState<Map<string, PautaActionState>>(new Map());
  const pautaActionInFlightRef = useRef<Set<string>>(new Set());
  const [confirmedMatches, setConfirmedMatches] = useState<Array<{ pautaId: string; collab: NarrativeCollabMatch }>>([]);
  const [openMatch, setOpenMatch] = useState<{ pautaId: string; variant: "celebration" | "revisit" } | null>(null);
  const [collabsBootstrap, setCollabsBootstrap] = useState<{
    status: CollabsBootstrapStatus;
    signature: string | null;
    error: string | null;
  }>({ status: "idle", signature: null, error: null });
  const [collabsBootstrapRetry, setCollabsBootstrapRetry] = useState(0);
  const collabsReadySignatureRef = useRef("");
  const collabsBootstrapRequestRef = useRef(0);

  const collabsPautas = useMemo(
    () => (localContentIdeas.length >= data.contentIdeas.length ? localContentIdeas : data.contentIdeas),
    [data.contentIdeas, localContentIdeas],
  );
  const collabsNarrativeLabel = useMemo(
    () =>
      data.mapaSeed?.narrativa_central?.trim() ||
      data.mainNarrativeLabel ||
      resolveDiagnosticoLeadingNarrativeSignal(data.synthesis)?.label ||
      null,
    [data.mainNarrativeLabel, data.mapaSeed, data.synthesis],
  );
  const collabsInputSignature = useMemo(
    () => JSON.stringify({
      version: 2,
      plan: data.userInfo.plan,
      narrativeLabel: collabsNarrativeLabel,
      pautas: collabsPautas.map((p) => ({
        id: p.id,
        territory: p.territory,
        title: p.title,
      })),
    }),
    [collabsNarrativeLabel, collabsPautas, data.userInfo.plan],
  );
  const effectiveCollabsBootstrapStatus: CollabsBootstrapStatus =
    collabsBootstrap.signature === collabsInputSignature
      ? collabsBootstrap.status
      : "loading";

  useEffect(() => {
    if (activeTab !== "collabs") return;
    if (collabsReadySignatureRef.current === collabsInputSignature) return;

    const requestId = ++collabsBootstrapRequestRef.current;
    const controller = new AbortController();
    const localDecisions = readContentIdeaLocalDecisions(localPautaDecisionStorageKey);

    setCollabsBootstrap({ status: "loading", signature: collabsInputSignature, error: null });

    const commitLocalDecisions = () => {
      if (localDecisions.size === 0) return;
      setPautaActionStates((prev) => {
        const next = new Map(prev);
        for (const [id, kind] of localDecisions.entries()) {
          if (!next.has(id)) next.set(id, { kind, phase: "confirmed" });
        }
        return next;
      });
    };

    const commitReady = () => {
      collabsReadySignatureRef.current = collabsInputSignature;
      setCollabsBootstrap({ status: "ready", signature: collabsInputSignature, error: null });
    };

    // Free não consulta identidades reais, mas ainda respeita a transição única
    // loading → ready para não hidratar decisões locais depois do primeiro card.
    if (data.userInfo.plan !== "Pro") {
      commitLocalDecisions();
      setPautaCollabs(new Map());
      setCollabDecisions(new Map());
      setConfirmedMatches([]);
      commitReady();
      return () => controller.abort();
    }

    if (collabsPautas.length === 0) {
      commitLocalDecisions();
      setPautaCollabs(new Map());
      setCollabDecisions(new Map());
      setConfirmedMatches([]);
      commitReady();
      return () => controller.abort();
    }

    if (!collabsNarrativeLabel) {
      setCollabsBootstrap({
        status: "error",
        signature: collabsInputSignature,
        error: "Confirme sua narrativa no Perfil antes de preparar esta rodada.",
      });
      return () => controller.abort();
    }

    void (async () => {
      try {
        const [matchesResponse, interestResponse] = await Promise.all([
          fetch("/api/dashboard/mobile-strategic-profile/collabs/per-pauta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              narrativeLabel: collabsNarrativeLabel,
              pautas: collabsPautas.map((p) => ({ id: p.id, territory: p.territory, title: p.title })),
            }),
            signal: controller.signal,
          }),
          fetch("/api/dashboard/mobile-strategic-profile/collabs/interest", {
            signal: controller.signal,
          }),
        ]);
        const [matchesJson, interestJson] = await Promise.all([
          matchesResponse.json().catch(() => null),
          interestResponse.json().catch(() => null),
        ]);
        if (controller.signal.aborted || collabsBootstrapRequestRef.current !== requestId) return;
        if (!matchesResponse.ok || !matchesJson?.ok) throw new Error("matches_unavailable");
        if (!interestResponse.ok || !interestJson?.ok) throw new Error("interest_unavailable");

        const nextDecisions = new Map<string, CollabStackDecision>();
        if (Array.isArray(interestJson.decisions)) {
          for (const decision of interestJson.decisions) {
            if (
              typeof decision?.pautaId === "string" &&
              (decision.decision === "interested" || decision.decision === "dismissed")
            ) {
              nextDecisions.set(decision.pautaId, decision.decision);
            }
          }
        }
        const nextMatches = Array.isArray(interestJson.matches) ? interestJson.matches : [];
        const freshMatches = nextMatches.filter((match: { isNew?: boolean }) => match?.isNew);

        // React 18 agrupa estes updates do mesmo ciclo assíncrono. O status
        // `ready` só entra junto do snapshot completo, produzindo uma revelação.
        commitLocalDecisions();
        setPautaCollabs(new Map(Object.entries(matchesJson.matches ?? {})));
        setCollabDecisions(nextDecisions);
        setConfirmedMatches(nextMatches);
        if (freshMatches.length > 0) {
          setOpenMatch({ pautaId: freshMatches[0].pautaId, variant: "celebration" });
        }
        commitReady();

        if (freshMatches.length > 0) {
          const celebratedPautaIds = freshMatches.map((match: { pautaId: string }) => match.pautaId);
          void fetch("/api/dashboard/mobile-strategic-profile/collabs/interest", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ celebratedPautaIds }),
          }).catch(() => {});
        }
      } catch (error) {
        if (controller.signal.aborted || collabsBootstrapRequestRef.current !== requestId) return;
        setCollabsBootstrap({
          status: "error",
          signature: collabsInputSignature,
          error: "Não foi possível sincronizar sugestões e matches. Tente novamente.",
        });
      }
    })();

    return () => controller.abort();
  }, [
    activeTab,
    collabsBootstrapRetry,
    collabsInputSignature,
    collabsNarrativeLabel,
    collabsPautas,
    data.userInfo.plan,
    localPautaDecisionStorageKey,
  ]);

  const handleRetryCollabsBootstrap = useCallback(() => {
    collabsReadySignatureRef.current = "";
    setCollabsBootstrapRetry((value) => value + 1);
  }, []);

  const setLocalIdeaStatus = useCallback((
    id: string,
    status: DiagnosticoPageData["contentIdeas"][number]["status"],
  ) => {
    setLocalContentIdeas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p)),
    );
  }, []);

  const setPautaAction = useCallback((id: string, state: PautaActionState) => {
    setPautaActionStates((prev) => {
      const next = new Map(prev);
      next.set(id, state);
      return next;
    });
  }, []);

  const clearPautaAction = useCallback((id: string) => {
    setPautaActionStates((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const actionErrorMessage = useCallback((kind: PautaActionKind, reason?: string) => {
    if (kind === "collab-interest") return "Não foi possível registrar a collab agora. Tente novamente.";
    if (kind === "dismiss") return "Descartada nesta sessão. Não consegui sincronizar; se recarregar, ela pode voltar.";
    if (kind === "unsave") return "Removida da lista. Não consegui sincronizar; se recarregar, ela pode voltar.";
    if (reason === "storage_unavailable") return "Não foi possível salvar agora. Tente novamente.";
    return "Não foi possível salvar agora. Tente novamente.";
  }, []);

  const persistPautaStatus = useCallback(async (
    id: string,
    status: DiagnosticoPageData["contentIdeas"][number]["status"],
  ) => {
    const res = await fetch(`/api/dashboard/mobile-strategic-profile/content-ideas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { reason?: string; message?: string };
      const err = new Error(body.message ?? String(res.status)) as Error & { reason?: string };
      err.reason = body.reason;
      throw err;
    }
  }, []);

  const findCurrentPauta = useCallback((pautaId: string) => {
    const pautasNow = localContentIdeas.length >= data.contentIdeas.length ? localContentIdeas : data.contentIdeas;
    return pautasNow.find((p) => p.id === pautaId) ?? null;
  }, [data.contentIdeas, localContentIdeas]);

  const registerCollabInterest = useCallback(async (pautaId: string) => {
    const collab = pautaCollabs.get(pautaId);
    const pauta = findCurrentPauta(pautaId);
    if (!collab || !pauta) throw new Error("missing_collab_context");

    const res = await fetch("/api/dashboard/mobile-strategic-profile/collabs/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pautaId,
        pautaTitle: pauta.title,
        territory: pauta.territory,
        partnerId: collab.id,
        fitReason: collab.narrativeFitReason,
        sharedSignal: collab.sharedSignal,
        recordingIdea: collab.collabRecordingIdea,
        collabMode: collab.collabMode,
        decision: "interested",
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json().catch(() => null);
    if (!json?.ok) throw new Error("collab_interest_failed");

    setCollabDecisions((prev) => {
      const next = new Map(prev);
      next.set(pautaId, "interested");
      return next;
    });

    if (json.matched && json.match) {
      setConfirmedMatches((prev) =>
        prev.some((m) => m.pautaId === pautaId) ? prev : [...prev, { pautaId, collab: json.match }],
      );
      setOpenMatch({ pautaId, variant: "celebration" });
    }
  }, [findCurrentPauta, pautaCollabs]);

  const handleConnectInstagram = useCallback(() => {
    if (data.userInfo.plan !== "Pro") {
      openPaywallModal({
        context: "narrative_map",
        source: "mobile_profile_instagram_connect",
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: "connect_instagram",
      });
      return;
    }
    router.push(MOBILE_INSTAGRAM_CONNECT_ROUTE);
  }, [data.userInfo.plan, router]);

  const handleOpenMediaKit = useCallback(() => {
    if (data.userInfo.plan !== "Pro") {
      openPaywallModal({
        context: "media_kit",
        source: "mobile_profile_media_kit",
        returnTo: MOBILE_PROFILE_ROUTE,
      });
      return;
    }
    if (!data.instagramConnected) {
      router.push(MOBILE_INSTAGRAM_CONNECT_ROUTE);
      return;
    }
    const slug = data.userInfo.mediaKitSlug?.trim();
    if (slug) {
      setMediaKitSheetSlug(slug);
    } else {
      router.push(MOBILE_MEDIA_KIT_ROUTE);
    }
  }, [data.userInfo.plan, data.instagramConnected, data.userInfo.mediaKitSlug, router]);

  const handleOpenCreatorMediaKit = useCallback((slug: string) => {
    setMediaKitSheetSlug(slug);
  }, []);
  const closeAccountMenu = useCallback(() => {
    setAccountMenuOpen(false);
  }, []);
  const handleOpenAccountMediaKit = useCallback(() => {
    setAccountMenuOpen(false);
    handleOpenMediaKit();
  }, [handleOpenMediaKit]);
  const handleOpenCalculator = useCallback(() => {
    if (data.userInfo.plan !== "Pro") {
      openPaywallModal({
        context: "calculator",
        source: "mobile_profile_calculator",
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: data.instagramConnected ? undefined : "connect_instagram",
      });
      return;
    }
    setCalculatorWizardOpen(true);
  }, [data.instagramConnected, data.userInfo.plan]);

  // Abrir a pauta (roteiro completo + por que o criador é ideal pra collab) é Pro.
  // Free vê o card (título + direcional) como teaser; o tap abre o paywall.
  const handleOpenIdea = useCallback((id: string) => {
    if (data.userInfo.plan !== "Pro") {
      openPaywallModal({
        context: "planning",
        source: "mobile_idea_open",
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: data.instagramConnected ? undefined : "connect_instagram",
      });
      return;
    }
    setOpenIdeaId(id);
  }, [data.instagramConnected, data.userInfo.plan]);

  const beginPautaAction = useCallback((id: string) => {
    if (pautaActionInFlightRef.current.has(id)) return false;
    pautaActionInFlightRef.current.add(id);
    return true;
  }, []);

  const finishPautaAction = useCallback((id: string) => {
    pautaActionInFlightRef.current.delete(id);
  }, []);

  // Salvar explicitamente: usado no deck. Falha não recoloca a pauta no deck;
  // ela fica na estante da sessão como "não sincronizada" com retry.
  const handleSavePauta = useCallback((id: string) => {
    if (data.userInfo.plan !== "Pro") {
      openPaywallModal({
        context: "planning",
        source: "mobile_idea_save",
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: data.instagramConnected ? undefined : "connect_instagram",
      });
      return;
    }
    if (!beginPautaAction(id)) return;
    forgetContentIdeaLocalDecision(localPautaDecisionStorageKey, id);
    setLocalIdeaStatus(id, "saved");
    setPautaAction(id, { kind: "save", phase: "pending" });
    void (async () => {
      try {
        await persistPautaStatus(id, "saved");
        clearPautaAction(id);
      } catch (err) {
        setPautaAction(id, {
          kind: "save",
          phase: "failed",
          message: actionErrorMessage("save", (err as { reason?: string })?.reason),
        });
      } finally {
        finishPautaAction(id);
      }
    })();
  }, [
    actionErrorMessage,
    beginPautaAction,
    clearPautaAction,
    data.instagramConnected,
    data.userInfo.plan,
    finishPautaAction,
    localPautaDecisionStorageKey,
    persistPautaStatus,
    setLocalIdeaStatus,
    setPautaAction,
  ]);

  // Remover da estante explicitamente: decisão final do usuário, não volta ao deck.
  const handleUnsavePauta = useCallback((id: string) => {
    if (!beginPautaAction(id)) return;
    rememberContentIdeaLocalDecision(localPautaDecisionStorageKey, id, "unsave");
    setLocalIdeaStatus(id, "dismissed");
    setPautaAction(id, { kind: "unsave", phase: "confirmed" });
    void (async () => {
      try {
        await persistPautaStatus(id, "dismissed");
        setPautaAction(id, { kind: "unsave", phase: "confirmed" });
      } catch {
        setPautaAction(id, { kind: "unsave", phase: "confirmed" });
      } finally {
        finishPautaAction(id);
      }
    })();
  }, [
    beginPautaAction,
    finishPautaAction,
    localPautaDecisionStorageKey,
    persistPautaStatus,
    setLocalIdeaStatus,
    setPautaAction,
  ]);

  // Rejeitar uma pauta no deck = descarte PERMANENTE (status "dismissed"). O read
  // service filtra "dismissed", então ela nunca mais é lida — não volta no reload
  // nem numa geração futura. Rejeitar é livre (sem paywall); só salvar/gerar é Pro.
  const handleDismissPauta = useCallback((id: string) => {
    if (!beginPautaAction(id)) return;
    rememberContentIdeaLocalDecision(localPautaDecisionStorageKey, id, "dismiss");
    setLocalIdeaStatus(id, "dismissed");
    setPautaAction(id, { kind: "dismiss", phase: "confirmed" });
    void (async () => {
      try {
        await persistPautaStatus(id, "dismissed");
        clearPautaAction(id);
      } catch {
        setPautaAction(id, { kind: "dismiss", phase: "confirmed" });
      } finally {
        finishPautaAction(id);
      }
    })();
  }, [
    beginPautaAction,
    clearPautaAction,
    finishPautaAction,
    localPautaDecisionStorageKey,
    persistPautaStatus,
    setLocalIdeaStatus,
    setPautaAction,
  ]);

  const handleAcceptCollabPauta = useCallback((id: string) => {
    if (data.userInfo.plan !== "Pro") {
      openPaywallModal({
        context: "narrative_map",
        source: "mobile_collabs_accept",
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: data.instagramConnected ? undefined : "connect_instagram",
      });
      return;
    }
    if (!beginPautaAction(id)) return;
    forgetContentIdeaLocalDecision(localPautaDecisionStorageKey, id);
    setLocalIdeaStatus(id, "saved");
    setPautaAction(id, { kind: "save", phase: "pending" });
    void (async () => {
      try {
        const pauta = findCurrentPauta(id);
        if (pauta?.status !== "saved") {
          await persistPautaStatus(id, "saved");
        }
      } catch (err) {
        setPautaAction(id, {
          kind: "save",
          phase: "failed",
          message: actionErrorMessage("save", (err as { reason?: string })?.reason),
        });
        finishPautaAction(id);
        return;
      }

      setPautaAction(id, { kind: "collab-interest", phase: "pending" });
      try {
        await registerCollabInterest(id);
        clearPautaAction(id);
      } catch {
        setPautaAction(id, {
          kind: "collab-interest",
          phase: "failed",
          message: actionErrorMessage("collab-interest"),
        });
      } finally {
        finishPautaAction(id);
      }
    })();
  }, [
    actionErrorMessage,
    beginPautaAction,
    clearPautaAction,
    data.instagramConnected,
    data.userInfo.plan,
    findCurrentPauta,
    finishPautaAction,
    localPautaDecisionStorageKey,
    persistPautaStatus,
    registerCollabInterest,
    setLocalIdeaStatus,
    setPautaAction,
  ]);

  const handleRetryPautaAction = useCallback((id: string) => {
    const state = pautaActionStates.get(id);
    if (!state) return;
    if (state.kind === "save") {
      handleSavePauta(id);
    } else if (state.kind === "unsave") {
      handleUnsavePauta(id);
    } else if (state.kind === "dismiss") {
      handleDismissPauta(id);
    } else {
      handleAcceptCollabPauta(id);
    }
  }, [handleAcceptCollabPauta, handleDismissPauta, handleSavePauta, handleUnsavePauta, pautaActionStates]);

  const handleOpenAccountCommunity = useCallback(() => {
    // Abre a Comunidade DENTRO do shell (não sai para outra rota) —
    // o usuário mantém o contexto do produto.
    setAccountMenuOpen(false);
    setOpenCategory("community");
  }, []);

  // Grupo da comunidade no WhatsApp — Pro entra direto; free vê o paywall.
  // `source` distingue a superfície de origem na telemetria do paywall.
  const openWhatsAppCommunity = useCallback((source: string) => {
    if (data.userInfo.plan === "Pro") {
      window.open(COMMUNITY_WHATSAPP_URL, "_blank", "noopener,noreferrer");
    } else {
      openPaywallModal({
        context: "narrative_map",
        source,
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: "join_community",
      });
    }
  }, [data.userInfo.plan]);
  const handleOpenWhatsAppGroup = useCallback(
    () => openWhatsAppCommunity("mobile_profile_whatsapp_community"),
    [openWhatsAppCommunity],
  );
  const handleOpenCollabsWhatsAppCommunity = useCallback(
    () => openWhatsAppCommunity("mobile_collabs_whatsapp_community"),
    [openWhatsAppCommunity],
  );
  const handleOpenAccountInstagramConnection = useCallback(() => {
    setAccountMenuOpen(false);
    handleConnectInstagram();
  }, [handleConnectInstagram]);

  // O3: conectar Instagram durante o onboarding — vai direto ao OAuth,
  // sem passar pela página de pré-conexão (redundante com a InstagramScreen).
  // Fallback para a rota de pré-conexão caso o OAuth falhe ao iniciar.
  const handleOnboardingConnectInstagram = useCallback(async () => {
    try {
      sessionStorage.setItem("d2c_onboarding_resume_step", "question_1");
    } catch {
      // sessionStorage indisponível — fallback gracioso.
    }
    try {
      await startInstagramReconnect({
        nextTarget: "narrative-map",
        source: "onboarding_instagram_screen",
      });
    } catch {
      router.push(MOBILE_INSTAGRAM_CONNECT_ROUTE);
    }
  }, [router]);
  const handleOpenAccountBilling = useCallback(() => {
    setAccountMenuOpen(false);
    router.push("/dashboard/billing");
  }, [router]);
  const handleAccountUpgrade = useCallback(() => {
    setAccountMenuOpen(false);
    openPaywallModal({
      context: "narrative_map",
      source: "account_menu_upgrade",
      returnTo: MOBILE_PROFILE_ROUTE,
      // Se ainda não conectou o Instagram, encadeia a conexão após o checkout.
      postCheckoutIntent: data.instagramConnected ? undefined : "connect_instagram",
    });
  }, [data.instagramConnected]);
  const handleOpenAccountAffiliates = useCallback(() => {
    setAccountMenuOpen(false);
    router.push("/afiliados");
  }, [router]);
  const handleContactSupport = useCallback(() => {
    setAccountMenuOpen(false);
    window.location.href = "mailto:support@data2content.ai";
  }, []);
  const handleAccountSignOut = useCallback(() => {
    setAccountMenuOpen(false);
    signOut({ callbackUrl: "/" });
  }, []);
  const handledInstagramLinked = useRef(false);
  const collabSuggestionsCacheRef = useRef(new Map<string, DiagnosticoCollabSuggestionsState>());
  const creatorDirectoryRequestedRef = useRef(false);
  const { state: readingDetailState, fetch: fetchReading, reset: resetReading } = useReadingDetail();

  // Mutex: opening a category closes any open reading detail (and vice versa)
  const handleOpenCategory = useCallback((id: CategoryId) => {
    resetReading();
    setDiagnosisOverviewOpen(false);
    if ((id === "brands" || id === "collabs") && !isMapReadyForExpansion) {
      setAccessMessage("Confirme narrativa e territórios antes de abrir expansão.");
      setOpenCategory("narrative");
      return;
    }
    setOpenCategory(id);
  }, [isMapReadyForExpansion, resetReading]);

  const handleOpenDiagnosisOverview = useCallback(() => {
    resetReading();
    setOpenCategory(null);
    setDiagnosisOverviewOpen(true);
  }, [resetReading]);

  // Record this visit so next time we can show "X posts analisados desde sua última visita".
  // Fire-and-forget; the data on this render reflects the OLD lastMapVisitAt and is unaffected.
  useEffect(() => {
    void fetch("/api/dashboard/mobile-strategic-profile/last-map-visit", {
      method: "POST",
    }).catch(() => { /* non-fatal */ });
  }, []);

  useEffect(() => {
    if (data.userInfo.plan !== "Pro") {
      setLatestCalculation(null);
      return;
    }

    let cancelled = false;
    void fetch("/api/calculator/latest", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) return null;
        return response.json() as Promise<MobileCalculatorResult>;
      })
      .then((calculation) => {
        if (!cancelled && calculation) {
          setLatestCalculation(calculation);
        }
      })
      .catch(() => {
        // Non-fatal: the card keeps the first-calculation CTA.
      });

    return () => {
      cancelled = true;
    };
  }, [data.userInfo.plan]);

  // Extracted so the user can also retry manually from the card.
  // `focusedTerritory` (opcional) semeia a geração a partir de um território —
  // usado pela ação "Gerar pautas de {território}" do card "Sua Audiência".
  const triggerGenerateIdeas = useCallback(async (focusedTerritory?: string) => {
    // Guarda: onRetryGenerateIdeas é usado como onClick em vários lugares, então o 1º
    // argumento pode ser um MouseEvent. Só tratamos como território se for string.
    const territory = typeof focusedTerritory === "string" && focusedTerritory.trim() ? focusedTerritory.trim() : null;
    if (generatingRef.current) return;
    generatingRef.current = true;
    setIsGeneratingIdeas(true);
    setIdeaGenerationBlocker(null);
    console.log("[d2c:pautas] → iniciando geração", territory ? `(território: ${territory})` : "");
    try {
      const res = await fetch("/api/dashboard/mobile-strategic-profile/content-ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(territory ? { focusedTerritory: territory } : {}),
      });
      console.log("[d2c:pautas] ← resposta status:", res.status);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const reason = typeof body?.reason === "string" ? body.reason : "failed";
        console.warn(`[d2c:pautas] ERRO ${res.status} reason=${reason} —`, body?.message ?? "");
        if (reason === "premium_required") {
          setIdeaGenerationBlocker("premium_required");
        } else if (reason === "quota_exceeded") {
          setIdeaGenerationBlocker("quota_exceeded");
          if (typeof body?.resetAt === "string") setIdeaQuotaResetAt(body.resetAt);
        } else if (reason === "map_not_ready" || reason === "no_narrative" || reason === "no_territories") {
          setIdeaGenerationBlocker("map_incomplete");
        } else {
          setIdeaGenerationBlocker("failed");
        }
        return;
      }
      const resJson = await res.json() as {
        ok: boolean;
        ideas?: Array<{
          id: string; title: string; angle: string; hook: string;
          territory: string; assets: string[]; suggestedFormat: string;
          tone: string | null; whyItFits: string;
          scriptPoints: string[]; scriptClosing: string | null;
          resonanceNote?: string | null;
          generatedAt: string;
        }>;
      };
      console.log("[d2c:pautas] ideas na resposta:", resJson?.ideas?.length ?? 0, resJson?.ideas?.map(i => i.title));
      if (Array.isArray(resJson?.ideas) && resJson.ideas.length > 0) {
        const newIdeas = resJson.ideas.map((idea) => ({
          ...idea,
          scriptPoints: idea.scriptPoints ?? [],
          scriptClosing: idea.scriptClosing ?? null,
          resonanceNote: idea.resonanceNote ?? null,
          status: "active" as const,
          scheduledFor: null,
        }));
        // Espelha o servidor: a leva nova entra como `active`; as pautas SALVAS
        // que o criador guardou permanecem (o servidor só supersede `active`).
        // As `active` anteriores saem — viraram `superseded` lá. Assim o card
        // mostra a leva fresca + as salvas, sem acumular pautas velhas localmente.
        setLocalContentIdeas((prev) => {
          const newIds = new Set(newIdeas.map((i) => i.id));
          const keptSaved = prev.filter((p) => p.status === "saved" && !newIds.has(p.id));
          return [...newIdeas, ...keptSaved];
        });
        console.log("[d2c:pautas] localContentIdeas atualizado ✓");
        // Use startTransition so the local state update renders BEFORE the
        // router refresh re-fetches server data.  Without this, the Suspense
        // boundary can show its blank fallback and reset all local state
        // before the chips ever appear on screen.
        startTransition(() => {
          router.refresh();
        });
      } else {
        console.warn("[d2c:pautas] 200 mas sem ideias na resposta — resJson:", resJson);
        // Treat an unexpected empty-ideas success as a failure so the UI
        // shows the retry button rather than the infinite "Preparando..." state.
        setIdeaGenerationBlocker("failed");
      }
    } catch (err) {
      console.warn("[d2c:pautas] Erro de rede:", err);
      setIdeaGenerationBlocker("failed");
    } finally {
      generatingRef.current = false;
      setIsGeneratingIdeas(false);
    }
  }, [router]);

  // Auto-disparo quando o mapa fica pronto e não há pautas (ou estão velhas >7 dias,
  // ou o mapa foi enriquecido depois da última pauta). Reativo a `ready`/contagem:
  // além do mount, dispara quando a prontidão vira true após um router.refresh() —
  // ex.: o enriquecimento assíncrono do Instagram concluiu e o polling abaixo trouxe
  // dados frescos. O ref garante disparo único por mount.
  useEffect(() => {
    const ready = data.contentIdeasReadiness.ready;
    const noIdeas = data.contentIdeas.length === 0;
    const latestIdea = data.contentIdeas[0];
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isStale = latestIdea
      ? Date.now() - new Date(latestIdea.generatedAt).getTime() > SEVEN_DAYS_MS
      : false;
    // Mapa enriquecido (Instagram/vídeo) após a última pauta → regenera uma vez para
    // refletir narrativa/territórios novos. Computado no servidor por timestamp; uma
    // vez regenerado, a nova pauta fica mais recente que o enriquecimento e o flag
    // volta a false, sem loop.
    const mapStale = data.contentIdeasMapStale === true;
    if (ready && (noIdeas || isStale || mapStale) && !autoGenerateTriggeredRef.current) {
      autoGenerateTriggeredRef.current = true;
      void triggerGenerateIdeas();
    }
  }, [
    data.contentIdeasReadiness.ready,
    data.contentIdeas.length,
    data.contentIdeasMapStale,
    triggerGenerateIdeas,
  ]);

  // Polling pós-conexão de Instagram. O enriquecimento do MapaSeed (sync de dados +
  // leitura visual do Gemini) roda async no worker QStash e leva alguns segundos.
  // O hard-reload pós-conexão chega antes disso, então a prontidão das pautas ainda
  // é falsa no mount. Re-busca os dados do servidor em intervalos para que, assim que
  // o mapa for enriquecido, o auto-disparo acima gere as pautas — sem o criador
  // precisar recarregar. Limitado no tempo; para assim que ficar pronto ou surgir pauta.
  const MAX_IG_POLL_ATTEMPTS = 12; // ~120s @ 10s
  const [igPollTick, setIgPollTick] = useState(0);
  // Captura, uma vez, se já havia pautas no momento em que o IG foi conectado.
  // Define o que o polling espera: sem pautas → espera elas surgirem (auto-disparo
  // pós-enriquecimento); com pautas → espera o enriquecimento tornar o mapa "stale"
  // (mapStale), quando o auto-disparo regenera a partir do mapa novo.
  const hadIdeasAtLinkRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (instagramJustLinked && hadIdeasAtLinkRef.current === null) {
      hadIdeasAtLinkRef.current = data.contentIdeas.length > 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instagramJustLinked]);
  // Latch: uma vez que o servidor reporta o mapa enriquecido após a última pauta,
  // o enriquecimento foi detectado — o auto-disparo cuida da regeneração.
  const staleSeenRef = useRef(false);
  useEffect(() => {
    if (data.contentIdeasMapStale) staleSeenRef.current = true;
  }, [data.contentIdeasMapStale]);
  useEffect(() => {
    if (!instagramJustLinked || !data.instagramConnected) return;
    if (igPollTick >= MAX_IG_POLL_ATTEMPTS) return;
    const settled = hadIdeasAtLinkRef.current === true
      ? staleSeenRef.current
      : data.contentIdeasReadiness.ready || data.contentIdeas.length > 0;
    if (settled) return;
    const timer = setTimeout(() => {
      setIgPollTick((t) => t + 1);
      router.refresh();
    }, 10000);
    return () => clearTimeout(timer);
  }, [
    instagramJustLinked,
    data.instagramConnected,
    data.contentIdeasReadiness.ready,
    data.contentIdeas.length,
    data.contentIdeasMapStale,
    igPollTick,
    router,
  ]);

  // O card de pautas mostra "processando" só enquanto vale a pena esperar: acabou de
  // conectar o IG, ainda não está pronto e o polling não esgotou. Quando esgota (ex.:
  // amostragem de Instagram insuficiente), volta ao teaser normal oferecendo o vídeo.
  const instagramEnrichmentPending =
    instagramJustLinked &&
    data.instagramConnected &&
    !data.contentIdeasReadiness.ready &&
    data.contentIdeas.length === 0 &&
    igPollTick < MAX_IG_POLL_ATTEMPTS;

  // Detect ?instagramLinked=true → show a map-focused return notice (fires at most once per mount)
  // O3: também lê d2c_onboarding_resume_step para retomar o onboarding no
  // step correto quando o criador voltou de conectar Instagram durante o flow.
  useEffect(() => {
    if (!handledInstagramLinked.current && searchParams.get("instagramLinked") === "true") {
      handledInstagramLinked.current = true;
      setShowInstagramConnectedNotice(true);

      // Dispara o enriquecimento do MapaSeed imediatamente — sem depender do
      // worker QStash, que pode não estar configurado em todos os ambientes.
      // Após conclusão, router.refresh() atualiza o card "Seu Mapa" com os
      // territórios/assets/tom vindos do Instagram. Non-fatal: o cron periódico
      // ainda cobre o usuário se esta chamada falhar.
      fetch("/api/onboarding/instagram-enrich", { method: "POST" })
        .then(() => router.refresh())
        .catch(() => {});

      // O3: se o criador veio do onboarding, retoma no step salvo.
      try {
        const savedStep = sessionStorage.getItem("d2c_onboarding_resume_step") as OnboardingStep | null;
        if (savedStep) {
          setOnboardingInitialStep(savedStep);
          sessionStorage.removeItem("d2c_onboarding_resume_step");
        }
      } catch {
        // sessionStorage indisponível — onboarding reinicia do welcome sem problema.
      }

      // Remove the param from the URL without triggering a navigation
      const next = new URL(window.location.href);
      next.searchParams.delete("instagramLinked");
      router.replace(next.pathname + (next.search || ""), { scroll: false });
    }
  }, [searchParams, router]);

  // Detect ?openCommunity=1 → auto-open the Community detail after post-checkout redirect.
  // The billing/success page appends this param when postCheckoutIntent === "join_community",
  // so the new subscriber lands directly inside the community view.
  const handledOpenCommunity = useRef(false);
  useEffect(() => {
    if (!handledOpenCommunity.current && searchParams.get("openCommunity") === "1") {
      handledOpenCommunity.current = true;
      setOpenCategory("community");
      const next = new URL(window.location.href);
      next.searchParams.delete("openCommunity");
      router.replace(next.pathname + (next.search || ""), { scroll: false });
    }
  }, [searchParams, router]);

  // Restore thumbnails from localStorage
  useEffect(() => {
    const map: Record<string, string> = {};
    try {
      for (const reading of data.readings) {
        const stored = localStorage.getItem(`d2c_thumb_${reading.diagnosisId}`);
        if (stored) map[reading.diagnosisId] = stored;
      }
    } catch {
      // localStorage unavailable — non-fatal
    }
    if (Object.keys(map).length > 0) setLocalThumbnails(map);
  }, [data.readings]);

  const collabSuggestionsRequest = useMemo(() => {
    if (!isMapReadyForExpansion) return { key: "blocked", payload: null };
    // Fase C: narrative-map matching does NOT require Instagram — removed instagramConnected guard.
    // Free users will hit the API and receive a 403/inactive which is surfaced as "upgrade_required".
    const payload = buildMobileCollabSuggestionsPayload(data);
    if (!payload) return { key: "empty", payload: null };
    return {
      key: JSON.stringify({
        version: 1,
        narrativeLabel: payload.narrativeLabel,
        collabTerritories: payload.collabTerritories.map((territory) => territory.label),
        commercialTerritories: payload.commercialTerritories.map((territory) => territory.label),
      }),
      payload,
    };
  }, [data, isMapReadyForExpansion]);

  useEffect(() => {
    if (collabSuggestionsRequest.key === "blocked") {
      setCollabSuggestions({ status: "blocked", items: [], error: null });
      return;
    }

    if (collabSuggestionsRequest.key === "empty" || !collabSuggestionsRequest.payload) {
      setCollabSuggestions({ status: "ready", items: [], error: null });
      return;
    }

    const cached = collabSuggestionsCacheRef.current.get(collabSuggestionsRequest.key);
    if (cached) {
      setCollabSuggestions(cached);
      return;
    }

    const controller = new AbortController();
    setCollabSuggestions({ status: "loading", items: [], error: null });

    const loadSuggestions = async () => {
      try {
        const response = await fetch("/api/dashboard/mobile-strategic-profile/collabs/suggestions", {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(collabSuggestionsRequest.payload),
        });
        const payload = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;

        if (!response.ok) {
          if (payload?.reason === "instagram_required") {
            // Pro user, map confirmed, but Instagram not connected — blocked (old path)
            const blockedState: DiagnosticoCollabSuggestionsState = {
              status: "blocked",
              items: [],
              error: null,
            };
            collabSuggestionsCacheRef.current.set(collabSuggestionsRequest.key, blockedState);
            setCollabSuggestions(blockedState);
            return;
          }
          if (payload?.reason === "inactive" || response.status === 403) {
            // Free user — plan tier blocks collabs. Show soft upgrade teaser, not a hard error.
            const upgradeState: DiagnosticoCollabSuggestionsState = {
              status: "upgrade_required",
              items: [],
              error: null,
            };
            collabSuggestionsCacheRef.current.set(collabSuggestionsRequest.key, upgradeState);
            setCollabSuggestions(upgradeState);
            return;
          }
          throw new Error(payload?.error || "Não foi possível carregar collabs.");
        }

        const readyState: DiagnosticoCollabSuggestionsState = {
          status: "ready",
          items: Array.isArray(payload?.items) ? payload.items.slice(0, 3) : [],
          error: null,
        };
        collabSuggestionsCacheRef.current.set(collabSuggestionsRequest.key, readyState);
        setCollabSuggestions(readyState);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCollabSuggestions({
          status: "error",
          items: [],
          error: error instanceof Error ? error.message : "Não foi possível carregar collabs.",
        });
      }
    };

    void loadSuggestions();

    return () => {
      controller.abort();
    };
  }, [collabSuggestionsRequest]);

  const loadCreatorDirectory = useCallback(async () => {
    if (creatorDirectoryRequestedRef.current) return;
    creatorDirectoryRequestedRef.current = true;
    setCreatorDirectory({ status: "loading", creators: [], error: null });

    try {
      const params = new URLSearchParams({ mode: "full", surface: "board" });
      const response = await fetch(`/api/landing/casting?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Não foi possível carregar os criadores D2C agora.");
      }
      const payload = await response.json().catch(() => ({}));
      setCreatorDirectory({
        status: "ready",
        creators: Array.isArray(payload?.creators) ? payload.creators : [],
        error: null,
      });
    } catch (error) {
      creatorDirectoryRequestedRef.current = false;
      setCreatorDirectory({
        status: "error",
        creators: [],
        error: error instanceof Error ? error.message : "Não foi possível carregar os criadores D2C agora.",
      });
    }
  }, []);

  useEffect(() => {
    // Collabs: diretório carrega junto do matching (exige mapa pronto).
    // Comunidade: diretório é prova social aberta — carrega para qualquer usuário.
    // Stories Row: carrega no mount para exibir prova social no header.
    if (openCategory === "community" || (openCategory === "collabs" && isMapReadyForExpansion)) {
      void loadCreatorDirectory();
    }
  }, [isMapReadyForExpansion, loadCreatorDirectory, openCategory]);

  useEffect(() => {
    // Carrega o diretório no mount — alimenta as detail views de Comunidade e Collabs.
    void loadCreatorDirectory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewReading = useCallback(() => {
    setAccessMessage(null);
    const state = data.accessState;

    if (
      state === "free_unused" ||
      state === "pro_needs_instagram" ||
      state === "pro_instagram_connected" ||
      state === "admin"
    ) {
      setAnalyzeFlowOpen(true);
      return;
    }
    if (state === "free_preview_used") {
      openPaywallModal({
        context: "narrative_map",
        source: "mobile_profile_free_used",
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: "connect_instagram",
      });
      return;
    }
    if (state === "pro_quota_reached") {
      setAccessMessage("Você chegou ao limite deste mês. Seu diagnóstico continua aqui — novas leituras voltam no início do próximo mês.");
      return;
    }
    if (state === "payment_pending" || state === "payment_action_needed") {
      openPaywallModal({
        context: "narrative_map",
        source: "mobile_profile",
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: "connect_instagram",
      });
      return;
    }
    // Any other blocked state → paywall
    openPaywallModal({
      context: "narrative_map",
      source: "mobile_profile",
      returnTo: MOBILE_PROFILE_ROUTE,
      postCheckoutIntent: "connect_instagram",
    });
  }, [data.accessState, router]);

  const handleOpenReading = useCallback(
    (diagnosisId: string) => {
      fetchReading(diagnosisId);
    },
    [fetchReading],
  );

  const handleAnalyzeSubmit = useCallback(
    async (payload: {
      creatorGoal: string;
      selectedGoalOption: "authority" | "authority_build" | "retention" | "format_test" | "sponsored_content";
      quickAnswers?: Array<{ id: string; value: string }>;
      mockScenario?: string;
      consentTextVersion?: string;
      temporaryUpload?: {
        uploadSessionId: string;
        objectKey?: string;
        mimeType: string;
        sizeBytes: number;
        durationSeconds?: number;
        uploadedAt?: string;
      };
    }): Promise<MobileStrategicProfileAnalyzeResult> => {
      if (REAL_ANALYSIS_ENABLED && !payload.temporaryUpload?.uploadSessionId) {
        throw new Error("Envie o vídeo antes de iniciar a leitura real.");
      }

      const useReal = REAL_ANALYSIS_ENABLED && Boolean(payload.temporaryUpload?.uploadSessionId);
      const endpoint = useReal
        ? "/api/dashboard/mobile-strategic-profile/analyze-real"
        : "/api/dashboard/mobile-strategic-profile/analyze";

      const body = useReal
        ? {
            uploadSessionId: payload.temporaryUpload!.uploadSessionId,
            temporaryUpload: {
              objectKey: payload.temporaryUpload!.objectKey,
              mimeType: payload.temporaryUpload!.mimeType,
              sizeBytes: payload.temporaryUpload!.sizeBytes,
              durationSeconds: payload.temporaryUpload!.durationSeconds,
              uploadedAt: payload.temporaryUpload!.uploadedAt,
            },
            creatorGoal: payload.creatorGoal,
            selectedGoalOption: payload.selectedGoalOption,
            quickAnswers: payload.quickAnswers,
            consentTextVersion:
              payload.consentTextVersion ||
              "mobile_strategic_profile_temporary_video_v1",
            persistReading: true,
            persistSynthesisSnapshot: true,
          }
        : {
            creatorGoal: payload.creatorGoal,
            selectedGoalOption: payload.selectedGoalOption,
            quickAnswers: payload.quickAnswers,
            mockScenario: payload.mockScenario,
            persistReading: true,
            persistSynthesisSnapshot: true,
          };

      const { response, data: responseData } = await postMobileStrategicProfileAnalysisJson({
        endpoint,
        body,
      });
      if (!response.ok) {
        const analysisError = new Error(responseData?.message ?? "Erro ao analisar vídeo.");
        // Surfaced by the flow to decide whether to offer "Tentar novamente".
        (analysisError as Error & { retryable?: boolean }).retryable = responseData?.retryable;
        throw analysisError;
      }

      const snap = responseData?.snapshot;
      const savedDiagnosisId = responseData?.videoReadingPersistence?.diagnosisId ?? null;
      const readingConfirmationData = await fetchAnalysisConfirmationDataFromReading(savedDiagnosisId);
      const baseConfirmationData = readingConfirmationData ?? (snap
        ? {
            diagnosisSummary: snap.diagnosisSummary ?? null,
            unlockedSignals: Array.isArray(snap.unlockedSignals)
              ? snap.unlockedSignals.slice(0, 2)
              : [],
            opportunities: Array.isArray(snap.opportunities)
              ? snap.opportunities.slice(0, 1)
              : [],
          }
        : null);
      // directAnswer + coherence verdict come only from the route snapshot, so merge
      // them in regardless of which base source we used.
      const confirmationData = baseConfirmationData
        ? {
            ...baseConfirmationData,
            directAnswer: snap?.directAnswer ?? null,
            coherenceVerdict: snap?.coherenceVerdict ?? null,
            coherenceReasoning: snap?.coherenceReasoning ?? null,
            contentPotentialScan: snap?.contentPotentialScan ?? null,
          }
        : snap?.directAnswer || snap?.coherenceVerdict || snap?.contentPotentialScan
          ? {
              diagnosisSummary: null,
              unlockedSignals: [],
              opportunities: [],
              directAnswer: snap?.directAnswer ?? null,
              coherenceVerdict: snap?.coherenceVerdict ?? null,
              coherenceReasoning: snap?.coherenceReasoning ?? null,
              contentPotentialScan: snap?.contentPotentialScan ?? null,
            }
          : null;
      return {
        contextQuestions: [],
        savedDiagnosisId,
        confirmationData,
      };
    },
    [],
  );

  const handleAnalyzeComplete = useCallback(
    async (result?: MobileStrategicProfileAnalyzeFlowCompleteResult) => {
      setAnalyzeFlowOpen(false);
      if (result?.thumbnailDataUrl && result.savedDiagnosisId) {
        try {
          localStorage.setItem(`d2c_thumb_${result.savedDiagnosisId}`, result.thumbnailDataUrl);
          setLocalThumbnails((prev) => ({
            ...prev,
            [result.savedDiagnosisId!]: result.thumbnailDataUrl!,
          }));
        } catch {
          // localStorage unavailable — non-fatal
        }
      }
      // Await any in-flight publishIntent PATCH before refreshing. The PATCH now
      // runs map enrichment synchronously (~2-5s), so waiting here ensures
      // router.refresh() loads the updated MapaSeed rather than the stale one.
      if (pendingPublishIntentRef.current) {
        await pendingPublishIntentRef.current.catch(() => {});
        pendingPublishIntentRef.current = null;
      }
      router.refresh();
    },
    [router],
  );

  const handlePublishIntentSubmit = useCallback(
    async (diagnosisId: string, intent: "yes" | "no") => {
      const promise = fetch(
        `/api/dashboard/mobile-strategic-profile/diagnosis/${encodeURIComponent(diagnosisId)}/publish-intent`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishIntent: intent }),
        },
      ).then(() => {}).catch(() => {});
      pendingPublishIntentRef.current = promise;
      return promise;
    },
    [],
  );

  const handleContentPotentialFeedbackSubmit = useCallback(
    async (diagnosisId: string, feedback: {
      target: "overall" | "evidence" | "direction";
      value: "helpful" | "not_in_video" | "wrong_intent";
      moment?: "opening" | "development" | "closing";
    }) => {
      await fetch(
        `/api/dashboard/mobile-strategic-profile/diagnosis/${encodeURIComponent(diagnosisId)}/content-potential-feedback`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(feedback),
        },
      ).then(() => {}).catch(() => {});
    },
    [],
  );

  const handleScanReportInteraction = useCallback((event: "copy_suggestion" | "adjustment_marked" | "rescan_started" | "feedback_submitted" | "publish_decision", actionType?: string) => {
    const eventNames: Record<typeof event, MobileNarrativeTelemetryEventName> = {
      copy_suggestion: "mobile_scan_suggestion_copied",
      adjustment_marked: "mobile_scan_adjustment_marked",
      rescan_started: "mobile_scan_rescan_started",
      feedback_submitted: "mobile_scan_feedback_submitted",
      publish_decision: "mobile_scan_publish_decision",
    };
    trackMobileNarrativeEvent(eventNames[event], { route: MOBILE_PROFILE_ROUTE, actionType });
  }, []);

  const handleCompletionUpgrade = useCallback(() => {
    setAnalyzeFlowOpen(false);
    openPaywallModal({
      context: "narrative_map",
      source: "mobile_profile_free_completion",
      returnTo: MOBILE_PROFILE_ROUTE,
      postCheckoutIntent: "connect_instagram",
    });
  }, []);

  const handleCleanupUpload = useCallback(
    async (payload: {
      uploadSessionId: string;
      objectKey?: string;
      reason: "analysis_completed" | "analysis_failed" | "user_cancelled" | "expired";
    }) => {
      await fetch("/api/dashboard/mobile-strategic-profile/upload-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    [],
  );

  // ── Narrative map confirmation callbacks ─────────────────────────────────────
  // Each callback applies an optimistic local update immediately, then persists
  // to the server in the background. Failures are silent — UX is never blocked.

  const patchConfirmation = useCallback(
    async (body: Record<string, string>) => {
      try {
        await fetch(
          "/api/dashboard/mobile-strategic-profile/confirm-map-dimension",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
      } catch {
        // Non-fatal — optimistic state already applied
      }
    },
    [],
  );

  const handleConfirmNarrative = useCallback((response: ConfirmationResponse) => {
    setNarrativeConfirmationState(response === "no" ? "dismissed" : "confirmed");
    void patchConfirmation({ dimension: "narrative", response });
  }, [patchConfirmation]);

  const handleConfirmTerritories = useCallback((response: ConfirmationResponse) => {
    setTerritoriesConfirmationState(response === "no" ? "dismissed" : "confirmed");
    void patchConfirmation({ dimension: "territories", response });
  }, [patchConfirmation]);

  const handleConfirmTone = useCallback((response: ConfirmationResponse) => {
    setToneConfirmationState(response === "no" ? "dismissed" : "confirmed");
    void patchConfirmation({ dimension: "tone", response });
  }, [patchConfirmation]);

  const handleConfirmAsset = useCallback(
    (assetLabel: string, response: AssetConfirmationResponse) => {
      // Optimistic: track per-asset state in a Map
      setAssetConfirmations((prev) => {
        const next = new Map(prev);
        next.set(assetLabel, response === "no" ? "dismissed" : "confirmed");
        return next;
      });
      void patchConfirmation({ dimension: "asset", response, assetLabel });
    },
    [patchConfirmation],
  );

  // ── Etapa 4: adjacent narratives ─────────────────────────────────────────────

  /**
   * Triggers AI detection of adjacent narrative candidates.
   * Returns detected candidates on success, null on failure.
   * MapaCard uses the return value for immediate optimistic update;
   * router.refresh() reconciles server state in the background.
   */
  const handleDetectAdjacents = useCallback(async (): Promise<Array<{ label: string }> | null> => {
    try {
      const res = await fetch(
        "/api/dashboard/mobile-strategic-profile/map/detect-adjacent-narratives",
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn("[adjacent] Detection failed:", res.status, body?.reason ?? "", body?.message ?? "");
        // Surface reason to help diagnose (visible in browser console)
        return null;
      }
      const json = await res.json().catch(() => null);
      const candidates: Array<{ label: string }> = json?.candidates ?? [];
      console.log(`[adjacent] Detection ok — ${candidates.length} candidates, source=${json?.source}`);
      if (candidates.length > 0) {
        // Background refresh to reconcile server state
        router.refresh();
      }
      return candidates;
    } catch (err) {
      console.warn("[adjacent] Detection error:", err);
      return null;
    }
  }, [router]);

  /**
   * Persists a creator's response to a detected adjacent narrative.
   * Fire-and-forget — MapaCard handles optimistic state.
   */
  const handleConfirmAdjacent = useCallback(
    async (label: string, response: "yes" | "almost" | "no") => {
      try {
        await fetch("/api/dashboard/mobile-strategic-profile/map/confirm-adjacent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm", label, response }),
        });
      } catch (err) {
        console.warn("[adjacent] Confirm error:", err);
      }
    },
    [],
  );

  /**
   * Adds a manually entered adjacent narrative label.
   * Fire-and-forget — MapaCard handles optimistic state.
   */
  const handleAddAdjacentNarrative = useCallback(async (label: string) => {
    try {
      await fetch("/api/dashboard/mobile-strategic-profile/map/confirm-adjacent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", label }),
      });
    } catch (err) {
      console.warn("[adjacent] Add error:", err);
    }
  }, []);

  // Hydrate reading thumbnails into data
  const hydratedReadings = data.readings.map((r) =>
    localThumbnails[r.diagnosisId] ? { ...r, thumbnailUrl: localThumbnails[r.diagnosisId] } : r,
  );

  const leadingNarrative = resolveDiagnosticoLeadingNarrativeSignal(data.synthesis);
  // Prefer local (populated by generation) over server when local has at least as many ideas.
  const effectiveContentIdeas =
    localContentIdeas.length >= data.contentIdeas.length
      ? localContentIdeas
      : data.contentIdeas;

  const hydratedData = {
    ...data,
    readings: hydratedReadings,
    contentIdeas: effectiveContentIdeas,
    mainNarrativeLabel: data.mainNarrativeLabel ?? leadingNarrative?.label ?? null,
    mapConfirmations: localMapConfirmations,
    brandMapConfirmed: data.brandMapConfirmed || isMapReadyForExpansion,
    // Reflete o propósito salvo localmente (Meu Norte) sem esperar router.refresh —
    // faz o prompt "Defina seu norte" sumir assim que o criador salva.
    onboardingAnswers: {
      whyYouCreate: data.onboardingAnswers?.whyYouCreate ?? null,
      desiredFeeling: data.onboardingAnswers?.desiredFeeling ?? null,
      contentLimit: data.onboardingAnswers?.contentLimit ?? null,
      creatorPurpose: localPurpose,
    },
  };

  return (
    <div
      className={`d2c-mobile-app fixed inset-0 flex flex-col overflow-hidden ${d2cFontVariables}`}
      style={{
        background: "var(--ds-color-paper)",
      }}
    >
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
          // Fundo branco explícito: essa faixa reservada (paddingBottom, ~1rem
          // maior que a altura real da DiagnosticoTabBar de propósito — é
          // respiro visual antes da tab bar) hoje mostra branco só porque o
          // gradiente acima já resolveu pra #ffffff bem antes de chegar aqui.
          // Isso é uma dependência implícita e frágil: se algum dia o
          // gradiente mudar (parar mais peachy, por mais tempo), essa faixa
          // reaparece com a cor errada, sem nenhum aviso. Fundo explícito
          // remove essa dependência — a faixa é sempre branca, ponto.
          background: "var(--ds-color-paper)",
        }}
      >
        {activeTab === "collabs" ? (
          <DiagnosticoCollabsFeed
            pautas={effectiveContentIdeas}
            isPro={hydratedData.userInfo.plan === "Pro"}
            whatsappLinked={hydratedData.userInfo.whatsappLinked ?? false}
            isGeneratingIdeas={isGeneratingIdeas}
            ideaGenerationBlocker={ideaGenerationBlocker}
            pautaCollabs={pautaCollabs}
            pautaCollabsLoading={effectiveCollabsBootstrapStatus === "loading"}
            bootstrapStatus={effectiveCollabsBootstrapStatus}
            bootstrapError={collabsBootstrap.error}
            onRetryBootstrap={handleRetryCollabsBootstrap}
            collabDecisions={collabDecisions}
            pautaActionStates={pautaActionStates}
            onRetryPautaAction={handleRetryPautaAction}
            confirmedMatches={confirmedMatches}
            onOpenMatch={(pautaId) => setOpenMatch({ pautaId, variant: "revisit" })}
            onOpenIdea={handleOpenIdea}
            onSavePauta={handleSavePauta}
            onUnsavePauta={handleUnsavePauta}
            onAcceptCollabPauta={handleAcceptCollabPauta}
            onDismissPauta={handleDismissPauta}
            onOpenWhatsAppCommunity={handleOpenCollabsWhatsAppCommunity}
            onConnectWhatsApp={() => setWhatsAppSheetOpen(true)}
            onUpgrade={(ctx) => openPaywallModal({
              context: typeof ctx === "string" ? ctx : "narrative_map",
              source: typeof ctx === "string" ? `mobile_collabs_${ctx}` : "mobile_collabs",
              returnTo: MOBILE_PROFILE_ROUTE,
              postCheckoutIntent: "connect_instagram",
            })}
            onGenerate={triggerGenerateIdeas}
            onBackToPerfil={() => setActiveTab("perfil")}
          />
        ) : (
        <DiagnosticoPage
          data={hydratedData}
          collabSuggestions={collabSuggestions}
          creatorDirectory={creatorDirectory}
          onNewReading={handleNewReading}
          onOpenReading={handleOpenReading}
          onConnectInstagram={handleConnectInstagram}
          onUpgrade={(ctx) => openPaywallModal({
            // Cada superfície do card passa seu próprio contexto (ex.: "whatsapp",
            // "planning") para condicionar a copy do modal. Sem contexto válido cai
            // no mapa narrativo. O typeof guarda contra um evento de clique vazar aqui.
            context: typeof ctx === "string" ? ctx : "narrative_map",
            source: typeof ctx === "string" ? `mobile_profile_${ctx}` : "mobile_profile_empty_state",
            returnTo: MOBILE_PROFILE_ROUTE,
            postCheckoutIntent: "connect_instagram",
          })}
          onOpenCategory={handleOpenCategory}
          onOpenCommunity={handleOpenAccountCommunity}
          onOpenWhatsAppGroup={handleOpenWhatsAppGroup}
          onOpenMediaKit={handleOpenMediaKit}
          onOpenCreatorMediaKit={handleOpenCreatorMediaKit}
          onOpenAccountMenu={() => setAccountMenuOpen(true)}
          onOpenSurvey={() => setSurveyOpen(true)}
          onOpenNorte={() => setNorteOpen(true)}
          onOpenDiagnosis={handleOpenDiagnosisOverview}
          narrativeConfirmationState={narrativeConfirmationState}
          onConfirmNarrative={handleConfirmNarrative}
          territoriesConfirmationState={territoriesConfirmationState}
          onConfirmTerritories={handleConfirmTerritories}
          toneConfirmationState={toneConfirmationState}
          onConfirmTone={handleConfirmTone}
          onConfirmAsset={handleConfirmAsset}
          assetConfirmations={assetConfirmations}
          isGeneratingIdeas={isGeneratingIdeas}
          ideaGenerationBlocker={ideaGenerationBlocker}
          ideaQuotaResetAt={ideaQuotaResetAt}
          onRetryGenerateIdeas={triggerGenerateIdeas}
          onGeneratePautasForTerritory={(territoryLabel) => {
            // Ponte leitura → criação: semeia a geração pelo território e leva o
            // criador à aba Collabs, onde as pautas frescas aparecem (com o loading).
            void triggerGenerateIdeas(territoryLabel);
            setActiveTab("collabs");
          }}
          instagramEnrichmentPending={instagramEnrichmentPending}
          onOpenIdea={handleOpenIdea}
          onConnectWhatsApp={() => setWhatsAppSheetOpen(true)}
          latestCalculation={latestCalculation}
          onOpenCalculator={handleOpenCalculator}
        />
        )}
      </div>

      {/* Tab bar mobile — abaixo da camada de overlays (z-50), que a cobrem. O "+"
          abre o upload via handleNewReading (mesma lógica de acesso do card). */}
      <DiagnosticoTabBar
        activeTab={activeTab}
        onSelectPerfil={() => setActiveTab("perfil")}
        onSelectCollabs={() => setActiveTab("collabs")}
        onPressPlus={handleNewReading}
      />

      {openIdeaId && (() => {
        const idea = hydratedData.contentIdeas.find((i) => i.id === openIdeaId);
        if (!idea) return null;
        // Decisão da pilha dentro da ficha — mesma ação, lugar diferente. Só pra
        // match real (Pro): no free a decisão fica na pilha (coração = paywall).
        const ideaCollab = pautaCollabs.get(openIdeaId) ?? null;
        const ideaMatched = confirmedMatches.some((m) => m.pautaId === openIdeaId);
        const ideaDecision = collabDecisions.get(openIdeaId);
        return (
          <DiagnosticoIdeaDetailSheet
            idea={idea}
            collab={ideaCollab}
            isPro={hydratedData.userInfo.plan === "Pro"}
            decisionPending={Boolean(ideaCollab) && !ideaDecision && !ideaMatched}
            onDecide={(decision) => {
              if (decision === "interested") {
                handleAcceptCollabPauta(openIdeaId);
              } else {
                handleDismissPauta(openIdeaId);
              }
              setOpenIdeaId(null);
            }}
            awaitingOtherSide={Boolean(ideaCollab) && ideaDecision === "interested" && !ideaMatched}
            onOpenCreatorMediaKit={handleOpenCreatorMediaKit}
            onUpgrade={() => openPaywallModal({
              context: "narrative_map",
              source: "mobile_idea_collab",
              returnTo: MOBILE_PROFILE_ROUTE,
              postCheckoutIntent: "connect_instagram",
            })}
            onClose={() => setOpenIdeaId(null)}
          />
        );
      })()}

      {/* Tela do match — comemoração no momento do match; revisit ao voltar por
          Combinadas ou pelo status no card. */}
      {openMatch && (() => {
        const match = confirmedMatches.find((m) => m.pautaId === openMatch.pautaId);
        const pauta = hydratedData.contentIdeas.find((i) => i.id === openMatch.pautaId);
        return match && pauta ? (
          <DiagnosticoCollabMatchOverlay
            pauta={pauta}
            collab={match.collab}
            viewerName={hydratedData.userInfo.name ?? "Você"}
            viewerAvatarUrl={hydratedData.userInfo.imageUrl}
            variant={openMatch.variant}
            onOpenIdea={(id) => {
              setOpenMatch(null);
              handleOpenIdea(id);
            }}
            onClose={() => setOpenMatch(null)}
          />
        ) : null;
      })()}

      {whatsAppSheetOpen ? (
        <DiagnosticoWhatsAppSheet onClose={() => setWhatsAppSheetOpen(false)} />
      ) : null}

      {mediaKitSheetSlug ? (
        <MediaKitSheet slug={mediaKitSheetSlug} onClose={() => setMediaKitSheetSlug(null)} />
      ) : null}

      {accountMenuOpen ? (
        <DiagnosticoAccountMenuSheet
          userInfo={hydratedData.userInfo}
          isPro={hydratedData.userInfo.plan === "Pro"}
          instagramConnected={hydratedData.instagramConnected}
          onClose={closeAccountMenu}
          onOpenMediaKit={handleOpenAccountMediaKit}
          onOpenCommunity={handleOpenAccountCommunity}
          onOpenInstagramConnection={handleOpenAccountInstagramConnection}
          onOpenBilling={handleOpenAccountBilling}
          onUpgrade={handleAccountUpgrade}
          onOpenAffiliates={handleOpenAccountAffiliates}
          onContactSupport={handleContactSupport}
          onSignOut={handleAccountSignOut}
          onOpenSurvey={() => setSurveyOpen(true)}
          onOpenNorte={() => setNorteOpen(true)}
          hasPurpose={Boolean(localPurpose)}
        />
      ) : null}

      <SurveyModal
        open={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        onSaved={() => {
          setSurveyOpen(false);
          router.refresh();
        }}
      />

      {norteOpen && (
        <DiagnosticoNorteView
          initialPurpose={localPurpose}
          onClose={() => setNorteOpen(false)}
          onSaved={(newPurpose) => {
            setLocalPurpose(newPurpose);
            // Declarar o propósito SEMEIA o MapaSeed no servidor (seedMapaSeedFromPurpose,
            // já concluído quando o PATCH responde). O card "Seu Mapa" renderiza esse
            // mapaSeed — sem re-buscar, ele só apareceria após um reload manual (parecia
            // erro). O refresh em transition re-busca o mapa semeado mantendo a UI atual
            // visível (sem flash de Suspense); o DiagnosticoPage re-sincroniza via
            // useEffect([data.mapaSeed]).
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {diagnosisOverviewOpen ? (
        <DiagnosticoOverviewDetailView
          data={hydratedData}
          onNewReading={handleNewReading}
          onOpenReadings={() => {
            setDiagnosisOverviewOpen(false);
            handleOpenCategory("readings");
          }}
          onOpenIdeas={() => {
            setDiagnosisOverviewOpen(false);
            handleOpenCategory("ideas");
          }}
          onClose={() => setDiagnosisOverviewOpen(false)}
        />
      ) : null}

      {/* ── Category detail overlays — full-screen, mutex with reading detail ─ */}
      {openCategory === "narrative" && (
        <DiagnosticoNarrativeDetailView
          synthesis={hydratedData.synthesis}
          instagramConnected={hydratedData.instagramConnected}
          instagramEnriched={hydratedData.instagramConnected && !!hydratedData.instagramMetrics}
          onClose={() => setOpenCategory(null)}
          narrativeConfirmationState={narrativeConfirmationState}
          onConfirmNarrative={handleConfirmNarrative}
          territoriesConfirmationState={territoriesConfirmationState}
          onConfirmTerritories={handleConfirmTerritories}
          toneConfirmationState={toneConfirmationState}
          onConfirmTone={handleConfirmTone}
          onConfirmAsset={handleConfirmAsset}
          assetConfirmations={assetConfirmations}
          endorsedHypotheses={hydratedData.mapConfirmations?.endorsedHypotheses ?? []}
          dismissedHypotheses={hydratedData.mapConfirmations?.dismissedHypotheses ?? []}
          adjacentNarrativesFromMap={hydratedData.mapConfirmations?.adjacentNarratives ?? []}
          onDetectAdjacents={handleDetectAdjacents}
          onConfirmAdjacent={handleConfirmAdjacent}
          onAddAdjacentNarrative={handleAddAdjacentNarrative}
        />
      )}
      {openCategory === "strategic" && (
        <DiagnosticoStrategicDetailView
          synthesis={hydratedData.synthesis}
          onClose={() => setOpenCategory(null)}
        />
      )}
      {openCategory === "execution" && (
        <DiagnosticoExecutionDetailView
          synthesis={hydratedData.synthesis}
          confirmedFormats={hydratedData.mapConfirmations?.confirmedFormats ?? []}
          onClose={() => setOpenCategory(null)}
        />
      )}
      {openCategory === "instagram" && (
        <DiagnosticoInstagramDetailView
          instagramMetrics={hydratedData.instagramMetrics}
          instagramConnected={hydratedData.instagramConnected}
          mainNarrativeLabel={hydratedData.mainNarrativeLabel}
          onConnectInstagram={handleConnectInstagram}
          onClose={() => setOpenCategory(null)}
        />
      )}
      {openCategory === "brands" && (
        <DiagnosticoBrandsDetailView
          synthesis={hydratedData.synthesis}
          brandMatches={hydratedData.brandMatches ?? []}
          brandMapConfirmed={hydratedData.brandMapConfirmed ?? false}
          onNewReading={handleNewReading}
          onClose={() => setOpenCategory(null)}
        />
      )}
      {openCategory === "collabs" && (
        <DiagnosticoCollabsDetailView
          synthesis={hydratedData.synthesis}
          instagramConnected={hydratedData.instagramConnected}
          suggestionsState={collabSuggestions}
          creatorDirectory={creatorDirectory}
          onConnectInstagram={handleConnectInstagram}
          onUpgrade={() => openPaywallModal({
            context: "narrative_map",
            source: "collabs_upgrade_teaser",
            returnTo: MOBILE_PROFILE_ROUTE,
          })}
          onOpenCommunity={handleOpenAccountCommunity}
          onOpenCreatorMediaKit={handleOpenCreatorMediaKit}
          onNewReading={handleNewReading}
          onClose={() => setOpenCategory(null)}
        />
      )}
      {openCategory === "community" && (
        <DiagnosticoCommunityDetailView
          creatorDirectory={creatorDirectory}
          isPro={hydratedData.userInfo.plan === "Pro"}
          onUpgrade={() => openPaywallModal({
            context: "narrative_map",
            source: "community_join_upsell",
            // Após assinar, volta ao perfil com ?openCommunity=1 para auto-abrir
            // o detail de Comunidade — o novo assinante entra sem fricção.
            returnTo: `${MOBILE_PROFILE_ROUTE}?openCommunity=1`,
            postCheckoutIntent: "join_community",
          })}
          onClose={() => setOpenCategory(null)}
        />
      )}
      {openCategory === "readings" && (
        <DiagnosticoReadingsDetailView
          readings={hydratedData.readings}
          mainNarrativeLabel={hydratedData.mainNarrativeLabel}
          accessState={hydratedData.accessState}
          readingQuota={hydratedData.readingQuota}
          canStartReading={getNarrativeMapAccessAction(hydratedData.accessState).canStartReading}
          onNewReading={handleNewReading}
          onOpenReading={handleOpenReading}
          onClose={() => setOpenCategory(null)}
        />
      )}
      {openCategory === "ideas" && (
        <DiagnosticoIdeasDetailView
          ideas={hydratedData.contentIdeas}
          readiness={hydratedData.contentIdeasReadiness}
          onClose={() => setOpenCategory(null)}
          onOpenIdea={handleOpenIdea}
        />
      )}

      {/* Upload "+" lives in the header; Mídia Kit remains a contextual card */}

      {/* Analyze flow overlay */}
      <MobileStrategicProfileAnalyzeFlow
        open={analyzeFlowOpen}
        onClose={() => setAnalyzeFlowOpen(false)}
        onComplete={handleAnalyzeComplete}
        onSubmitAnalysis={handleAnalyzeSubmit}
        onCreateUploadSession={requestUploadSession}
        onUploadToTemporarySignedUrl={uploadVideoToTemporarySignedUrl}
        enableRealAnalysis={REAL_ANALYSIS_ENABLED}
        onCleanupTemporaryUpload={handleCleanupUpload}
        onPublishIntentSubmit={handlePublishIntentSubmit}
        onContentPotentialFeedbackSubmit={handleContentPotentialFeedbackSubmit}
        onReportInteraction={handleScanReportInteraction}
        completionSecondaryAction={data.accessState === "free_unused" ? "upgrade" : "another_video"}
        onCompletionUpgrade={handleCompletionUpgrade}
        readingsSummary={(() => {
          const st = hydratedData.accessState;
          // Admin = leituras ilimitadas → sem contador.
          if (st === "admin") return null;
          const q = hydratedData.readingQuota;
          const isProPlan = st != null && !["free_unused", "free_preview_used"].includes(st);
          return isProPlan
            ? { isPro: true, used: q?.usedThisMonth ?? 0, limit: q?.proMonthlyLimit ?? 10 }
            : { isPro: false, used: q?.usedTotal ?? 0, limit: q?.freeTotalLimit ?? 1 };
        })()}
      />

      <MobileCalculatorWizard
        open={calculatorWizardOpen}
        onClose={() => setCalculatorWizardOpen(false)}
        latestCalculation={latestCalculation}
        suggestedReach={hydratedData.instagramMetrics?.avgReachPerPost ?? null}
        onSaved={(calculation) => {
          setLatestCalculation(calculation);
        }}
        showPricingIntro={hydratedData.userInfo.pricingProfileIncomplete ?? false}
        onSavePricingProfile={(payload) => {
          void fetch("/api/dashboard/mobile-strategic-profile/pricing-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => { /* não-fatal: o criador segue para a calculadora */ });
        }}
      />

      {/* Access message toast */}
      {accessMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm rounded-[16px] bg-zinc-950 px-4 py-3 text-[13px] text-white shadow-xl animate-in fade-in duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <span>{accessMessage}</span>
            <button
              onClick={() => setAccessMessage(null)}
              className="shrink-0 flex h-11 w-11 items-center justify-center text-white/50 hover:text-white leading-none text-[18px] -mr-2"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Instagram return notice — keep the creator inside the map journey */}
      {showInstagramConnectedNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Instagram conectado ao mapa"
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowInstagramConnectedNotice(false); }}
        >
          <div className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl flex flex-col items-center gap-5 animate-in slide-in-from-bottom duration-300">

            {/* Instagram/map icon bubble */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                width="28"
                height="28"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M17.5 6.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </div>

            {/* Copy */}
            <div className="text-center">
              <p className="text-[18px] font-bold text-zinc-950 leading-snug">
                Instagram conectado ao seu mapa
              </p>
              <p className="mt-2 text-[13px] text-zinc-500 leading-relaxed">
                A partir de agora, suas postagens ajudam a D2C perceber padrões, territórios e formatos sem você precisar preencher mais nada.
              </p>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={() => setShowInstagramConnectedNotice(false)}
              className="w-full rounded-full bg-zinc-950 py-3.5 text-center text-[15px] font-bold text-white shadow-md hover:bg-zinc-800 active:bg-zinc-900"
            >
              Voltar ao mapa
            </button>

            {/* Dismiss */}
            <button
              onClick={() => {
                setShowInstagramConnectedNotice(false);
                handleOpenCategory("instagram");
              }}
              className="text-[13px] text-zinc-400 hover:text-zinc-600"
            >
              Ver sinais do Instagram
            </button>
          </div>
        </div>
      )}

      {/* Reading detail overlay */}
      {readingDetailState.status === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50/80">
          <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-800 animate-spin" />
        </div>
      )}
      {readingDetailState.status === "loaded" && (
        <ReadingDetailView data={readingDetailState.data} onClose={resetReading} />
      )}
      {readingDetailState.status === "error" && (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-[16px] bg-zinc-950 px-4 py-3 text-[13px] text-white shadow-xl">
          {readingDetailState.message}
          <button onClick={resetReading} className="ml-3 font-semibold underline">
            Fechar
          </button>
        </div>
      )}

      {/* ── Onboarding overlay — shown once for new creators ────────────────── */}
      <MobileOnboardingFlow
        open={onboardingOpen}
        instagramConnected={hydratedData.instagramConnected}
        accessState={hydratedData.accessState}
        firstSignal={(() => {
          const leading = resolveDiagnosticoLeadingNarrativeSignal(hydratedData.synthesis);
          return leading ? { label: leading.label, summary: leading.summary } : null;
        })()}
        // O3: retomada após conectar Instagram — pula a tela de boas-vindas.
        initialStep={onboardingInitialStep ?? undefined}
        onConnectInstagram={handleOnboardingConnectInstagram}
        onRequestUpload={() => setAnalyzeFlowOpen(true)}
        onComplete={(answers) => {
          setOnboardingOpen(false);
          setOnboardingInitialStep(null);
          // Atualiza localPurpose imediatamente com o valor do onboarding —
          // sem depender do router.refresh() completar antes do usuário
          // abrir "Meu Norte". O useEffect de sync serve de fallback para
          // sessões futuras (fresh load após onboarding em outra sessão).
          if (answers?.creatorPurpose !== undefined) {
            setLocalPurpose(answers.creatorPurpose || null);
          }
          router.refresh();
        }}
      />

    </div>
  );
}
