"use client";

import { useCallback, useEffect, useState } from "react";
import { buildMobileStrategicProfileRealShellInput } from "./buildMobileStrategicProfileRealShellInput";
import { buildMobileStrategicProfile, type MobileStrategicProfile } from "../../../videoUpload/mobileStrategicProfileMapping";
import { buildMobileStrategicProfileExistingDataAdapter } from "../../../videoUpload/mobileStrategicProfileExistingDataAdapter";
import { buildMobileStrategicProfileFromSnapshot } from "../../../videoUpload/mobileStrategicProfileSnapshotMapping";
import { MobileStrategicProfilePreview } from "./MobileStrategicProfilePreview";
import { NarrativeMapMobileShell } from "./NarrativeMapMobileShell";
import { MobileStrategicProfileAnalyzeFlow } from "./MobileStrategicProfileAnalyzeFlow";
import { fetchHomeSummaryCached } from "../../../../home/homeSummaryClient";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { openPaywallModal } from "@/utils/paywallModal";
import { requestUploadSession } from "./mobileStrategicProfileUploadSessionClient";
import { uploadVideoToTemporarySignedUrl } from "./mobileStrategicProfileDirectUploadClient";
import type { CreatorNarrativeMapReadingPresentation } from "../../../videoUpload/creatorNarrativeMapReadingChapters";
import type { NarrativeMapMobileViewModel } from "../../../videoUpload/narrativeMapMobileViewModel";
import {
  normalizeNarrativeMapReadingQuotaSnapshot,
  resolveNarrativeMapAccessState,
  type NarrativeMapReadingQuotaSnapshot,
} from "../../../videoUpload/narrativeMapAccessState";
import type { VideoNarrativeSynthesisSnapshotWriteSummary } from "../../../videoUpload/videoNarrativeSafeResponseBuilder";

interface MobileStrategicProfileRealShellClientProps {
  session: any;
  stateQuery: string | null;
  initialSnapshotPayload?: any; // MobileStrategicProfileSnapshotPayload
  initialNarrativeMapViewModel?: NarrativeMapMobileViewModel | null;
  initialNarrativeMapPresentation?: CreatorNarrativeMapReadingPresentation | null;
  initialSynthesisSnapshotWrite?: VideoNarrativeSynthesisSnapshotWriteSummary | null;
  initialReadingQuota?: NarrativeMapReadingQuotaSnapshot | null;
  internalSnapshotReview?: boolean;
}

export function MobileStrategicProfileRealShellClient({
  session,
  stateQuery,
  initialSnapshotPayload,
  initialNarrativeMapViewModel,
  initialNarrativeMapPresentation,
  initialSynthesisSnapshotWrite,
  initialReadingQuota,
  internalSnapshotReview,
}: MobileStrategicProfileRealShellClientProps) {
  const realAnalysisEnabled = process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED === "1";
  const billing = useBillingStatus();
  const quota = normalizeNarrativeMapReadingQuotaSnapshot(initialReadingQuota);
  const sessionUser = session?.user as any;
  const accessState = resolveNarrativeMapAccessState({
    hasPremiumAccess: billing.hasResolvedOnce ? billing.hasPremiumAccess : sessionUser?.planStatus === "active",
    hasFullReportAccess: billing.hasResolvedOnce ? billing.hasFullReportAccess : sessionUser?.planStatus === "active",
    needsCheckout: billing.needsCheckout,
    needsPaymentAction: billing.needsPaymentAction,
    needsBilling: billing.needsBilling,
    needsPaymentUpdate: billing.needsPaymentUpdate,
    isAdmin: billing.isAdminViewer || sessionUser?.role === "admin" || sessionUser?.isAdmin || sessionUser?.isDev,
    instagram: billing.instagram ?? {
      connected: Boolean(sessionUser?.instagramConnected || sessionUser?.isInstagramConnected),
      needsReconnect: false,
    },
    readingQuota: quota,
  });

  // 1. Calcular o perfil inicial (Session-only, snapshot ou fixture via stateQuery)
  const [profile, setProfile] = useState<MobileStrategicProfile>(() => {
    if (stateQuery) {
      const input = buildMobileStrategicProfileRealShellInput({
        session,
        stateQuery,
      });
      return buildMobileStrategicProfile(input);
    }
    const input = buildMobileStrategicProfileFromSnapshot({
      sessionUser: session?.user ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        instagramConnected: Boolean(session.user.instagramConnected || session.user.isInstagramConnected),
        instagramUsername: session.user.instagramUsername,
        planStatus: session.user.planStatus,
      } : null,
      snapshotPayload: initialSnapshotPayload || null,
      accessLevel: session?.user?.planStatus === "active" ? "premium" : "free",
    });
    return buildMobileStrategicProfile(input);
  });

  const [isHydrating, setIsHydrating] = useState(false);
  const [mapAnalyzeFlowOpen, setMapAnalyzeFlowOpen] = useState(false);
  const [mapAccessMessage, setMapAccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Se for anônimo, não precisamos hidratar
    if (!session?.user) return;

    let active = true;

    async function hydrate() {
      setIsHydrating(true);
      try {
        const summary = await fetchHomeSummaryCached("all");
        if (!active) return;

        if (summary) {
          // Recalcula o perfil usando o adapter com os dados do summary
          const res = buildMobileStrategicProfileExistingDataAdapter({
            sessionUser: {
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
              instagramConnected: Boolean(session.user.instagramConnected || session.user.isInstagramConnected),
              instagramUsername: session.user.instagramUsername,
              planStatus: session.user.planStatus,
            },
            homeSummary: summary,
            diagnosisOverrideState: stateQuery,
            profileHref: "/dashboard/boards/mobile-profile",
            analyzeVideoHref: "/dashboard/boards/mobile-profile",
          });

          let diagnosisPresentation = res.profileInput.diagnosisPresentation;
          let extraState = {};

          // Carrega a apresentação a partir do snapshot persistido
          if (initialSnapshotPayload) {
            const { mapSnapshotToDiagnosisPresentation } = await import("../../../videoUpload/mobileStrategicProfileSnapshotMapping");
            diagnosisPresentation = mapSnapshotToDiagnosisPresentation(initialSnapshotPayload);
          }

          // Se estivermos em modo override de teste QA, mesclamos o estado da fixture
          if (stateQuery) {
            const { buildMobileStrategicProfileRealShellInput } = await import("./buildMobileStrategicProfileRealShellInput");
            const initialInput = buildMobileStrategicProfileRealShellInput({
              session,
              stateQuery,
            });
            diagnosisPresentation = initialInput.diagnosisPresentation || diagnosisPresentation;

            const { buildMobileStrategicProfilePreviewFixture } = await import("./buildMobileStrategicProfilePreviewFixture");
            const fixture = buildMobileStrategicProfilePreviewFixture({ state: stateQuery });
            extraState = fixture.profile.state;
          }

          const hydratedInput = {
            ...res.profileInput,
            diagnosisPresentation,
            state: {
              ...res.profileInput.state,
              ...extraState,
            },
          };

          setProfile(buildMobileStrategicProfile(hydratedInput));
        }
      } catch (err) {
        // Fallback silencioso em caso de erro no fetch
        console.error("Erro silencioso ao hidratar Perfil Estratégico:", err);
      } finally {
        if (active) {
          setIsHydrating(false);
        }
      }
    }

    hydrate();

    return () => {
      active = false;
    };
  }, [session, stateQuery, initialSnapshotPayload]);

  const handleAnalysisSubmit = useCallback(async (payload: {
    creatorGoal: string;
    selectedGoalOption: "authority" | "retention" | "format_test" | "sponsored_content";
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
  }) => {
    const shouldUseRealAnalysis =
      realAnalysisEnabled &&
      Boolean(payload.temporaryUpload?.uploadSessionId);
    const endpoint = shouldUseRealAnalysis
      ? "/api/dashboard/mobile-strategic-profile/analyze-real"
      : "/api/dashboard/mobile-strategic-profile/analyze";
    const requestPayload = shouldUseRealAnalysis
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
          consentTextVersion: payload.consentTextVersion || "mobile_strategic_profile_temporary_video_v1",
        }
      : {
          creatorGoal: payload.creatorGoal,
          selectedGoalOption: payload.selectedGoalOption,
          quickAnswers: payload.quickAnswers,
          mockScenario: payload.mockScenario,
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || "Erro ao conectar com o serviço de análise.");
    }

    const data = await response.json();
    if (data.snapshot) {
      const { buildMobileStrategicProfileFromSnapshot } = await import("../../../videoUpload/mobileStrategicProfileSnapshotMapping");
      const input = buildMobileStrategicProfileFromSnapshot({
        sessionUser: session?.user ? {
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          instagramConnected: Boolean(session.user.instagramConnected || session.user.isInstagramConnected),
          instagramUsername: session.user.instagramUsername,
          planStatus: session.user.planStatus,
        } : null,
        snapshotPayload: data.snapshot,
        accessLevel: session?.user?.planStatus === "active" ? "premium" : "free",
      });
      setProfile(buildMobileStrategicProfile(input));
    }
  }, [session, realAnalysisEnabled]);

  const handleCleanupTemporaryUpload = useCallback(async (payload: {
    uploadSessionId: string;
    objectKey?: string;
    reason: "analysis_completed" | "analysis_failed" | "user_cancelled" | "expired";
  }) => {
    const response = await fetch("/api/dashboard/mobile-strategic-profile/upload-cleanup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadSessionId: payload.uploadSessionId,
        objectKey: payload.objectKey,
        reason: payload.reason,
      }),
    });

    if (!response.ok) {
      throw new Error("Cleanup temporário não foi confirmado.");
    }
  }, []);

  const openProfilePaywall = useCallback(() => {
    openPaywallModal({
      context: "narrative_map",
      source: "mobile_profile",
      returnTo: "/dashboard/boards/mobile-strategic-profile",
      postCheckoutIntent: "connect_instagram",
    });
  }, []);

  const handleMapPrimaryAccessAction = useCallback(() => {
    setMapAccessMessage(null);
    if (accessState === "free_unused" || accessState === "pro_instagram_connected" || accessState === "pro_needs_instagram" || accessState === "admin") {
      if (accessState === "pro_needs_instagram") {
        window.location.href = "/dashboard/instagram/connect?next=narrative-map";
        return;
      }
      setMapAnalyzeFlowOpen(true);
      return;
    }
    if (accessState === "pro_quota_reached") {
      setMapAccessMessage("Você usou suas 10 leituras deste mês. Seu Perfil continua disponível.");
      return;
    }
    openProfilePaywall();
  }, [accessState, openProfilePaywall]);

  return (
    <div className="relative">
      {isHydrating && (
        <div
          className="absolute right-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-zinc-900/90 px-3 py-1.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm transition-opacity duration-300 pointer-events-none animate-pulse"
          id="hydration-indicator"
        >
          <svg className="animate-spin h-3 w-3 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Atualizando dados do Perfil...</span>
        </div>
      )}
      {initialNarrativeMapViewModel && initialNarrativeMapPresentation ? (
        <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
          <div className="mx-auto grid max-w-5xl gap-5">
            <NarrativeMapMobileShell
              viewModel={initialNarrativeMapViewModel}
              presentation={initialNarrativeMapPresentation}
              snapshotReview={initialSynthesisSnapshotWrite}
              internalReview={internalSnapshotReview}
              accessState={accessState}
              readingQuota={quota}
              onPrimaryAccessAction={handleMapPrimaryAccessAction}
            />
            {mapAccessMessage ? (
              <p className="mx-auto max-w-sm rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-zinc-950">
                {mapAccessMessage}
              </p>
            ) : null}
            <MobileStrategicProfileAnalyzeFlow
              open={mapAnalyzeFlowOpen}
              onClose={() => setMapAnalyzeFlowOpen(false)}
              onComplete={() => setMapAnalyzeFlowOpen(false)}
              onSubmitAnalysis={handleAnalysisSubmit}
              onCreateUploadSession={requestUploadSession}
              onUploadToTemporarySignedUrl={uploadVideoToTemporarySignedUrl}
              enableRealAnalysis={realAnalysisEnabled}
              onCleanupTemporaryUpload={handleCleanupTemporaryUpload}
            />
          </div>
        </main>
      ) : (
        <MobileStrategicProfilePreview
          profile={profile}
          isRealShell={true}
          onSubmitAnalysis={handleAnalysisSubmit}
          onCreateUploadSession={requestUploadSession}
          onUploadToTemporarySignedUrl={uploadVideoToTemporarySignedUrl}
          enableRealAnalysis={realAnalysisEnabled}
          onCleanupTemporaryUpload={handleCleanupTemporaryUpload}
          accessState={accessState}
          readingQuota={quota}
        />
      )}
    </div>
  );
}
