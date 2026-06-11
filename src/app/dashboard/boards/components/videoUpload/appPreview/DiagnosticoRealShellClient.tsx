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
  const handleOpenAccountCommunity = useCallback(() => {
    // Abre a Comunidade DENTRO do shell (não sai para outra rota) —
    // o usuário mantém o contexto do produto.
    setAccountMenuOpen(false);
    setOpenCategory("community");
  }, []);

  const handleOpenWhatsAppGroup = useCallback(() => {
    if (data.userInfo.plan === "Pro") {
      window.open("https://chat.whatsapp.com/BAeBQZ8zuhQJOxXXJJaTnH", "_blank", "noopener,noreferrer");
    } else {
      openPaywallModal({
        context: "narrative_map",
        source: "mobile_profile_whatsapp_community",
        returnTo: MOBILE_PROFILE_ROUTE,
        postCheckoutIntent: "join_community",
      });
    }
  }, [data.userInfo.plan]);
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
  const triggerGenerateIdeas = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setIsGeneratingIdeas(true);
    setIdeaGenerationBlocker(null);
    console.log("[d2c:pautas] → iniciando geração");
    try {
      const res = await fetch("/api/dashboard/mobile-strategic-profile/content-ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
        setLocalContentIdeas((prev) => [...newIdeas, ...prev]);
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

  // Auto-disparo no mount quando mapa está pronto e sem pautas ou pautas velhas (>7 dias).
  useEffect(() => {
    const ready = data.contentIdeasReadiness.ready;
    const noIdeas = data.contentIdeas.length === 0;
    const latestIdea = data.contentIdeas[0];
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isStale = latestIdea
      ? Date.now() - new Date(latestIdea.generatedAt).getTime() > SEVEN_DAYS_MS
      : false;
    if (ready && (noIdeas || isStale) && !autoGenerateTriggeredRef.current) {
      autoGenerateTriggeredRef.current = true;
      void triggerGenerateIdeas();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect ?instagramLinked=true → show a map-focused return notice (fires at most once per mount)
  // O3: também lê d2c_onboarding_resume_step para retomar o onboarding no
  // step correto quando o criador voltou de conectar Instagram durante o flow.
  useEffect(() => {
    if (!handledInstagramLinked.current && searchParams.get("instagramLinked") === "true") {
      handledInstagramLinked.current = true;
      setShowInstagramConnectedNotice(true);

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
    // Carrega o diretório no mount para a CreatorStoriesRow no header.
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
          }
        : snap?.directAnswer || snap?.coherenceVerdict
          ? {
              diagnosisSummary: null,
              unlockedSignals: [],
              opportunities: [],
              directAnswer: snap?.directAnswer ?? null,
              coherenceVerdict: snap?.coherenceVerdict ?? null,
              coherenceReasoning: snap?.coherenceReasoning ?? null,
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
    (result?: MobileStrategicProfileAnalyzeFlowCompleteResult) => {
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
      router.refresh();
    },
    [router],
  );

  const handlePublishIntentSubmit = useCallback(
    async (diagnosisId: string, intent: "yes" | "no") => {
      try {
        await fetch(
          `/api/dashboard/mobile-strategic-profile/diagnosis/${encodeURIComponent(diagnosisId)}/publish-intent`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publishIntent: intent }),
          },
        );
      } catch {
        // Non-fatal — the map will treat this reading as legacy (full weight)
      }
    },
    [],
  );

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
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: "#f2f2f7",
      }}
    >
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
      >
        <DiagnosticoPage
          data={hydratedData}
          collabSuggestions={collabSuggestions}
          creatorDirectory={creatorDirectory}
          onNewReading={handleNewReading}
          onOpenReading={handleOpenReading}
          onConnectInstagram={handleConnectInstagram}
          onUpgrade={() => openPaywallModal({
            context: "narrative_map",
            source: "mobile_profile_empty_state",
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
          instagramJustLinked={instagramJustLinked}
          onOpenIdea={(id) => setOpenIdeaId(id)}
          onConnectWhatsApp={() => setWhatsAppSheetOpen(true)}
          latestCalculation={latestCalculation}
          onOpenCalculator={handleOpenCalculator}
        />
      </div>

      {openIdeaId && (() => {
        const idea = hydratedData.contentIdeas.find((i) => i.id === openIdeaId);
        return idea ? (
          <DiagnosticoIdeaDetailSheet idea={idea} onClose={() => setOpenIdeaId(null)} />
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
          onSaved={(newPurpose) => setLocalPurpose(newPurpose)}
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
          onOpenIdea={(id) => setOpenIdeaId(id)}
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
