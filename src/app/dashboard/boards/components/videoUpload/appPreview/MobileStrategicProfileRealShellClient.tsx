"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import useInstagramStatus from "@/app/hooks/useInstagramStatus";
import { buildMobileStrategicProfileRealShellInput } from "./buildMobileStrategicProfileRealShellInput";
import { buildMobileStrategicProfile, type MobileStrategicProfile } from "../../../videoUpload/mobileStrategicProfileMapping";
import { buildMobileStrategicProfileExistingDataAdapter } from "../../../videoUpload/mobileStrategicProfileExistingDataAdapter";
import { buildMobileStrategicProfileFromSnapshot } from "../../../videoUpload/mobileStrategicProfileSnapshotMapping";
import { MobileStrategicProfilePreview } from "./MobileStrategicProfilePreview";
import { NarrativeMapMobileShell } from "./NarrativeMapMobileShell";
import {
  MobileStrategicProfileAnalyzeFlow,
  type MobileStrategicProfileAnalyzeContextQuestion,
  type MobileStrategicProfileAnalyzeResult,
  type MobileStrategicProfileAnalyzeFlowCompleteResult,
} from "./MobileStrategicProfileAnalyzeFlow";
import { fetchAnalysisConfirmationDataFromReading } from "./mobileStrategicProfileAnalysisConfirmationClient";
import { fetchHomeSummaryCached } from "../../../../home/homeSummaryClient";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { openPaywallModal } from "@/utils/paywallModal";
import { requestUploadSession } from "./mobileStrategicProfileUploadSessionClient";
import { uploadVideoToTemporarySignedUrl } from "./mobileStrategicProfileDirectUploadClient";
import { postMobileStrategicProfileAnalysisJson } from "./mobileStrategicProfileAnalysisSubmitClient";
import type { CreatorNarrativeMapReadingPresentation } from "../../../videoUpload/creatorNarrativeMapReadingChapters";
import type { NarrativeMapMobileViewModel } from "../../../videoUpload/narrativeMapMobileViewModel";
import {
  getNarrativeMapAccessAction,
  getNarrativeMapAccessLevelForUser,
  getNarrativeMapStatusCardContent,
  hasNarrativeMapInstagramConnection,
  hasNarrativeMapPremiumAccess,
  isNarrativeMapAdminUser,
  normalizeNarrativeMapReadingQuotaSnapshot,
  resolveNarrativeMapAccessState,
  type NarrativeMapReadingQuotaSnapshot,
} from "../../../videoUpload/narrativeMapAccessState";
import {
  buildMobileNarrativeTelemetryContext,
  getSafeMobileNarrativeErrorCode,
  trackMobileNarrativeEvent,
  type MobileNarrativeAnalysisMode,
} from "../../../videoUpload/mobileNarrativeTelemetry";
import {
  MOBILE_INSTAGRAM_CONNECT_ROUTE,
  MOBILE_MEDIA_KIT_ROUTE,
  MOBILE_PROFILE_ROUTE,
} from "../../../videoUpload/mobileStrategicProfileRoutes";
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

function normalizeProfileImageCandidate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

function resolveSessionInstagramProfileImage(sessionUser: any): string | null {
  const accounts = Array.isArray(sessionUser?.availableIgAccounts)
    ? sessionUser.availableIgAccounts
    : [];
  const accountId = normalizeProfileImageCandidate(sessionUser?.instagramAccountId);
  const matchingAccount = accountId
    ? accounts.find((account: any) => account?.igAccountId === accountId)
    : null;

  return (
    normalizeProfileImageCandidate(matchingAccount?.profile_picture_url) ||
    normalizeProfileImageCandidate(sessionUser?.profile_picture_url) ||
    normalizeProfileImageCandidate(sessionUser?.instagram?.profile_picture_url) ||
    normalizeProfileImageCandidate(sessionUser?.instagram?.profilePictureUrl) ||
    normalizeProfileImageCandidate(accounts.find((account: any) => account?.profile_picture_url)?.profile_picture_url) ||
    normalizeProfileImageCandidate(sessionUser?.image)
  );
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
  const router = useRouter();
  const realAnalysisEnabled = process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED === "1";
  const billing = useBillingStatus();
  const quota = normalizeNarrativeMapReadingQuotaSnapshot(initialReadingQuota);
  const sessionUser = session?.user as any;
  const instagramStatus = useInstagramStatus(Boolean(session?.user));
  const sessionHasPremiumAccess = hasNarrativeMapPremiumAccess(sessionUser);
  const sessionIsAdmin = isNarrativeMapAdminUser(sessionUser);
  const isPro = billing.hasResolvedOnce ? billing.hasPremiumAccess : sessionHasPremiumAccess;
  const instagramConnected = Boolean(
    (billing.instagram?.connected && !billing.instagram?.needsReconnect) ||
    hasNarrativeMapInstagramConnection(sessionUser),
  );
  const accessState = resolveNarrativeMapAccessState({
    hasPremiumAccess: isPro,
    hasFullReportAccess: billing.hasResolvedOnce ? billing.hasFullReportAccess : sessionHasPremiumAccess,
    needsCheckout: billing.needsCheckout,
    needsPaymentAction: billing.needsPaymentAction,
    needsBilling: billing.needsBilling,
    needsPaymentUpdate: billing.needsPaymentUpdate,
    isAdmin: billing.isAdminViewer || sessionIsAdmin,
    instagram: billing.instagram ?? {
      connected: hasNarrativeMapInstagramConnection(sessionUser),
      needsReconnect: false,
    },
    readingQuota: quota,
  });
  const telemetryContext = useMemo(() => buildMobileNarrativeTelemetryContext({
    route: MOBILE_PROFILE_ROUTE,
    accessState,
    isPro,
    instagramConnected,
    quotaUsedThisMonth: quota.usedThisMonth,
    quotaLimit: quota.proMonthlyLimit,
  }), [accessState, instagramConnected, isPro, quota.proMonthlyLimit, quota.usedThisMonth]);
  const profileImageUrl =
    normalizeProfileImageCandidate(instagramStatus.status?.profilePictureUrl) ||
    resolveSessionInstagramProfileImage(sessionUser);

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
      accessLevel: getNarrativeMapAccessLevelForUser(session?.user as any),
    });
    return buildMobileStrategicProfile(input);
  });

  const [isHydrating, setIsHydrating] = useState(false);
  const [mapAnalyzeFlowOpen, setMapAnalyzeFlowOpen] = useState(false);
  const [mapAccessMessage, setMapAccessMessage] = useState<string | null>(null);
  const [mapAccessMessageVariant, setMapAccessMessageVariant] = useState<"default" | "warning">("default");
  const [mapProfileUpdated, setMapProfileUpdated] = useState(false);
  const [latestReadingThumbnail, setLatestReadingThumbnail] = useState<string | null>(null);
  const [localThumbnailsByDiagnosisId, setLocalThumbnailsByDiagnosisId] = useState<Record<string, string>>({});
  const hasNarrativeMapShell = Boolean(initialNarrativeMapViewModel && initialNarrativeMapPresentation);

  // Load persisted thumbnails from localStorage on mount
  useEffect(() => {
    try {
      const map: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("d2c_thumb_")) {
          const diagnosisId = key.slice("d2c_thumb_".length);
          const value = localStorage.getItem(key);
          if (diagnosisId && value) map[diagnosisId] = value;
        }
      }
      if (Object.keys(map).length > 0) setLocalThumbnailsByDiagnosisId(map);
    } catch {
      // localStorage unavailable (SSR, private mode, etc.)
    }
  }, []);

  // Auto-dismiss access toast after 4 seconds
  useEffect(() => {
    if (!mapAccessMessage) return;
    const timer = setTimeout(() => setMapAccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [mapAccessMessage]);

  useEffect(() => {
    trackMobileNarrativeEvent("mobile_profile_viewed", telemetryContext);
    if (accessState === "pro_quota_reached") {
      trackMobileNarrativeEvent("mobile_quota_reached_seen", telemetryContext);
    }
  }, [accessState, telemetryContext]);

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

  const normalizeAdaptiveQuizQuestions = useCallback((adaptiveQuiz: any): MobileStrategicProfileAnalyzeContextQuestion[] => {
    const questions = Array.isArray(adaptiveQuiz?.questions) ? adaptiveQuiz.questions : [];
    return questions
      .map((question: any): MobileStrategicProfileAnalyzeContextQuestion | null => {
        const id = typeof question?.id === "string" ? question.id : typeof question?.key === "string" ? question.key : "";
        const title = typeof question?.title === "string" ? question.title.trim() : "";
        const options = Array.isArray(question?.options)
          ? question.options
              .map((option: any) => {
                const optionId = typeof option?.id === "string" ? option.id : "";
                const label = typeof option?.label === "string" ? option.label.trim() : "";
                if (!optionId || !label) return null;
                return {
                  id: optionId,
                  label,
                  value: typeof option?.learningSignalValue === "string" && option.learningSignalValue.trim()
                    ? option.learningSignalValue.trim()
                    : label,
                  recommended: Boolean(option?.recommended),
                };
              })
              .filter(Boolean)
          : [];
        if (!id || !title || options.length === 0) return null;
        return {
          id,
          question: title,
          helper: typeof question?.helper === "string" ? question.helper : null,
          options,
        };
      })
      .filter(Boolean)
      .slice(0, 4) as MobileStrategicProfileAnalyzeContextQuestion[];
  }, []);

  const handleAnalysisSubmit = useCallback(async (payload: {
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
    if (realAnalysisEnabled && !payload.temporaryUpload?.uploadSessionId) {
      trackMobileNarrativeEvent("mobile_analysis_failed", {
        ...telemetryContext,
        selectedGoalOption: payload.selectedGoalOption,
        analysisMode: "real_gated",
        safeErrorCode: "temporary_upload_required",
      });
      throw new Error("Envie o vídeo antes de iniciar a leitura real.");
    }

    const shouldUseRealAnalysis =
      realAnalysisEnabled &&
      Boolean(payload.temporaryUpload?.uploadSessionId);
    const analysisMode: MobileNarrativeAnalysisMode = shouldUseRealAnalysis ? "real_gated" : "mock";
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

    trackMobileNarrativeEvent("mobile_analysis_submitted", {
      ...telemetryContext,
      selectedGoalOption: payload.selectedGoalOption,
      analysisMode,
    });

    let data: any = null;
    let failureTracked = false;
    try {
      const { response, data: responseData, attempts } = await postMobileStrategicProfileAnalysisJson({
        endpoint,
        body: requestPayload,
      });
      data = responseData;
      if (attempts > 1) {
        trackMobileNarrativeEvent("mobile_analysis_retry_succeeded", {
          ...telemetryContext,
          selectedGoalOption: payload.selectedGoalOption,
          analysisMode,
          retryAttempts: attempts,
        });
      }
      const persistence = data?.videoReadingPersistence;
      const synthesis = data?.synthesisSnapshotWrite;
      const allowlistGatePassed = Boolean(data?.e2eBetaAudit?.allowlistGatePassed);

      if (persistence?.attempted) {
        trackMobileNarrativeEvent("mobile_reading_saved", {
          ...telemetryContext,
          analysisMode,
          allowlistGatePassed,
          readingSaved: Boolean(persistence.saved),
          safeErrorCode: persistence.saved ? undefined : persistence.errorCode ?? persistence.skippedReason,
        });
      }
      if (synthesis?.attempted) {
        trackMobileNarrativeEvent("mobile_synthesis_snapshot_write_attempted", {
          ...telemetryContext,
          analysisMode,
          allowlistGatePassed,
          synthesisWritten: Boolean(synthesis.written),
        });
        trackMobileNarrativeEvent(
          synthesis.written
            ? "mobile_synthesis_snapshot_write_succeeded"
            : "mobile_synthesis_snapshot_write_failed",
          {
            ...telemetryContext,
            analysisMode,
            allowlistGatePassed,
            synthesisWritten: Boolean(synthesis.written),
            safeErrorCode: synthesis.written ? undefined : synthesis.skippedReason,
          },
        );
      }

      if (!response.ok) {
        failureTracked = true;
        trackMobileNarrativeEvent("mobile_analysis_failed", {
          ...telemetryContext,
          selectedGoalOption: payload.selectedGoalOption,
          analysisMode,
          allowlistGatePassed,
          safeErrorCode: data?.code ?? data?.reason ?? `http_${response.status}`,
        });
        throw new Error(data.message || "Erro ao conectar com o serviço de análise.");
      }
    } catch (error) {
      if (!failureTracked) {
        trackMobileNarrativeEvent("mobile_analysis_failed", {
          ...telemetryContext,
          selectedGoalOption: payload.selectedGoalOption,
          analysisMode,
          safeErrorCode: getSafeMobileNarrativeErrorCode(error),
        });
      }
      throw error;
    }

    trackMobileNarrativeEvent("mobile_analysis_succeeded", {
      ...telemetryContext,
      selectedGoalOption: payload.selectedGoalOption,
      analysisMode,
      allowlistGatePassed: Boolean(data?.e2eBetaAudit?.allowlistGatePassed),
      readingSaved: Boolean(data?.videoReadingPersistence?.saved),
      synthesisWritten: Boolean(data?.synthesisSnapshotWrite?.written),
    });
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
        accessLevel: getNarrativeMapAccessLevelForUser(session?.user as any),
      });
      setProfile(buildMobileStrategicProfile(input));
      if (hasNarrativeMapShell) {
        router.refresh();
      }
    } else if (shouldUseRealAnalysis || hasNarrativeMapShell) {
      router.refresh();
    }
    // Build confirmation highlights from snapshot fields
    const snap = data?.snapshot;
    const savedDiagnosisId = data?.videoReadingPersistence?.diagnosisId ?? null;
    const readingConfirmationData = await fetchAnalysisConfirmationDataFromReading(savedDiagnosisId);
    const confirmationData = readingConfirmationData ?? (snap
      ? {
          diagnosisSummary: snap.diagnosisSummary ?? null,
          unlockedSignals: Array.isArray(snap.unlockedSignals) ? snap.unlockedSignals.slice(0, 2) : [],
          opportunities: Array.isArray(snap.opportunities) ? snap.opportunities.slice(0, 1) : [],
        }
      : null);

    return {
      contextQuestions: normalizeAdaptiveQuizQuestions(data?.adaptiveQuiz),
      savedDiagnosisId,
      confirmationData,
    };
  }, [hasNarrativeMapShell, normalizeAdaptiveQuizQuestions, router, session, realAnalysisEnabled, telemetryContext]);

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

  const handleConfirmationAnswer = useCallback(async (payload: {
    diagnosisId: string;
    answer: { questionId: string; questionText: string; answerId: string; answerValue: string };
  }) => {
    try {
      await fetch(`/api/dashboard/mobile-strategic-profile/reading/${payload.diagnosisId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: payload.answer }),
      });
    } catch {
      // fire-and-forget — falha silenciosa para não bloquear o criador
    }
  }, []);

  const openProfilePaywall = useCallback(() => {
    openPaywallModal({
      context: "narrative_map",
      source: "mobile_profile",
      returnTo: MOBILE_PROFILE_ROUTE,
      postCheckoutIntent: "connect_instagram",
    });
  }, []);

  const handleMapPrimaryAccessAction = useCallback(() => {
    setMapAccessMessage(null);
    const content = getNarrativeMapStatusCardContent({ state: accessState, quota });
    const accessAction = getNarrativeMapAccessAction(accessState);
    trackMobileNarrativeEvent("mobile_status_action_clicked", {
      ...telemetryContext,
      actionLabel: content.primaryLabel,
      actionType: accessAction.reason,
    });
    if (accessState === "pro_needs_instagram") {
      trackMobileNarrativeEvent("mobile_instagram_connect_clicked", {
        ...telemetryContext,
        actionLabel: content.primaryLabel,
        actionType: "connect_instagram",
      });
      window.location.href = MOBILE_INSTAGRAM_CONNECT_ROUTE;
      return;
    }
    if (accessState === "free_unused" || accessState === "pro_instagram_connected" || accessState === "admin") {
      trackMobileNarrativeEvent("mobile_upload_gate_checked", {
        ...telemetryContext,
        gateResult: "allowed",
        actionType: "start_reading",
      });
      trackMobileNarrativeEvent("mobile_new_reading_started", {
        ...telemetryContext,
        actionType: "start_reading",
      });
      setMapAnalyzeFlowOpen(true);
      return;
    }
    if (accessState === "pro_quota_reached") {
      trackMobileNarrativeEvent("mobile_upload_gate_checked", {
        ...telemetryContext,
        gateResult: "blocked",
        actionType: "start_reading",
        safeErrorCode: "pro_quota_reached",
      });
      trackMobileNarrativeEvent("mobile_upload_gate_blocked", {
        ...telemetryContext,
        gateResult: "blocked",
        actionType: "start_reading",
        safeErrorCode: "pro_quota_reached",
      });
      setMapAccessMessageVariant("default");
      setMapAccessMessage("Você usou suas 10 leituras deste mês. Seu Perfil continua disponível.");
      return;
    }
    if (accessState === "payment_pending") {
      setMapAccessMessageVariant("warning");
      setMapAccessMessage("Pagamento pendente. Conclua o pagamento para manter as leituras.");
      openProfilePaywall();
      return;
    }
    if (accessState === "payment_action_needed") {
      setMapAccessMessageVariant("warning");
      setMapAccessMessage("Ação necessária no pagamento. Atualize para não perder o Perfil.");
      openProfilePaywall();
      return;
    }
    trackMobileNarrativeEvent("mobile_upload_gate_checked", {
      ...telemetryContext,
      gateResult: "blocked",
      actionType: "start_reading",
      safeErrorCode: accessAction.reason,
    });
    trackMobileNarrativeEvent("mobile_upload_gate_blocked", {
      ...telemetryContext,
      gateResult: "blocked",
      actionType: "start_reading",
      safeErrorCode: accessAction.reason,
    });
    openProfilePaywall();
  }, [accessState, openProfilePaywall, quota, telemetryContext]);

  const handleMapSecondaryAccessAction = useCallback(() => {
    setMapAccessMessage(null);
    if (accessState === "pro_needs_instagram") {
      trackMobileNarrativeEvent("mobile_status_action_clicked", {
        ...telemetryContext,
        actionLabel: "Nova leitura",
        actionType: "start_reading",
      });
      trackMobileNarrativeEvent("mobile_upload_gate_checked", {
        ...telemetryContext,
        gateResult: "allowed",
        actionType: "start_reading",
      });
      trackMobileNarrativeEvent("mobile_new_reading_started", {
        ...telemetryContext,
        actionType: "start_reading",
      });
      setMapAnalyzeFlowOpen(true);
    }
  }, [accessState, telemetryContext]);

  const handleCreateUploadSession = useCallback(async (...args: Parameters<typeof requestUploadSession>) => {
    trackMobileNarrativeEvent("mobile_upload_session_requested", {
      ...telemetryContext,
      analysisMode: realAnalysisEnabled ? "real_gated" : "mock",
    });
    const response = await requestUploadSession(...args);
    if (response.ok) {
      trackMobileNarrativeEvent("mobile_upload_session_created", {
        ...telemetryContext,
        analysisMode: response.status === "signed_upload_session_created" ? "real_gated" : "mock",
        allowlistGatePassed: response.status === "signed_upload_session_created",
      });
    } else {
      trackMobileNarrativeEvent("mobile_upload_gate_blocked", {
        ...telemetryContext,
        gateResult: "blocked",
        safeErrorCode: response.issues?.find((issue) => issue.severity === "blocker")?.code ?? response.status,
        analysisMode: realAnalysisEnabled ? "real_gated" : "mock",
      });
    }
    return response;
  }, [realAnalysisEnabled, telemetryContext]);

  const handleUploadToTemporarySignedUrl = useCallback(async (...args: Parameters<typeof uploadVideoToTemporarySignedUrl>) => {
    const response = await uploadVideoToTemporarySignedUrl(...args);
    if (response.ok) {
      trackMobileNarrativeEvent("mobile_video_upload_completed", {
        ...telemetryContext,
        analysisMode: "real_gated",
        allowlistGatePassed: true,
      });
    } else {
      trackMobileNarrativeEvent("mobile_analysis_failed", {
        ...telemetryContext,
        analysisMode: "real_gated",
        safeErrorCode: response.status ?? "video_upload_failed",
      });
    }
    return response;
  }, [telemetryContext]);

  const handleMapAnalyzeComplete = useCallback((result?: MobileStrategicProfileAnalyzeFlowCompleteResult) => {
    setMapAnalyzeFlowOpen(false);
    setMapProfileUpdated(true);
    if (result?.thumbnailDataUrl) {
      setLatestReadingThumbnail(result.thumbnailDataUrl);
      // Persist thumbnail to localStorage so it survives page refreshes
      if (result.savedDiagnosisId) {
        try {
          localStorage.setItem(`d2c_thumb_${result.savedDiagnosisId}`, result.thumbnailDataUrl);
          setLocalThumbnailsByDiagnosisId((prev) => ({
            ...prev,
            [result.savedDiagnosisId!]: result.thumbnailDataUrl!,
          }));
        } catch {
          // localStorage may be unavailable or full — non-fatal
        }
      }
    }
    router.refresh();
  }, [router]);

  return (
    <div className="relative">
      {isHydrating && (
        <div
          className="sr-only"
          id="hydration-indicator"
          aria-live="polite"
        >
          <span>Sintonizando seu Perfil...</span>
        </div>
      )}
      {initialNarrativeMapViewModel && initialNarrativeMapPresentation ? (
        /* New full-screen shell — the component itself owns the h-dvh layout */
        <>
          <NarrativeMapMobileShell
            viewModel={initialNarrativeMapViewModel}
            presentation={initialNarrativeMapPresentation}
            snapshotReview={initialSynthesisSnapshotWrite}
            internalReview={internalSnapshotReview}
            accessState={accessState}
            readingQuota={quota}
            onPrimaryAccessAction={handleMapPrimaryAccessAction}
            onSecondaryAccessAction={handleMapSecondaryAccessAction}
            onOpenMediaKit={() => {
              trackMobileNarrativeEvent("mobile_mediakit_action_clicked", {
                ...telemetryContext,
                actionLabel: "Abrir Mídia Kit",
                actionType: "open_media_kit",
              });
              router.push(`${MOBILE_MEDIA_KIT_ROUTE}?from=mobile-strategic-profile`);
            }}
            profileUpdateNotice={mapProfileUpdated}
            profileSynthesisStatus={initialSynthesisSnapshotWrite?.synthesisStatus ?? null}
            newestReadingThumbnail={latestReadingThumbnail}
            localThumbnailsByDiagnosisId={localThumbnailsByDiagnosisId}
            profileImageUrl={profileImageUrl}
            userInfo={{
              name: sessionUser?.name ?? null,
              email: sessionUser?.email ?? null,
              plan: isPro ? "Pro" : "Free",
            }}
            onSignOut={() => signOut({ callbackUrl: "/" })}
            frameMode="app"
          />
          {/* Access message toast — floats above the bottom nav */}
          {mapAccessMessage ? (
            <p className={`fixed bottom-24 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ${
              mapAccessMessageVariant === "warning"
                ? "bg-amber-600 text-white"
                : "bg-zinc-950 text-white"
            }`}>
              {mapAccessMessage}
            </p>
          ) : null}
          <MobileStrategicProfileAnalyzeFlow
            open={mapAnalyzeFlowOpen}
            onClose={() => setMapAnalyzeFlowOpen(false)}
            onComplete={handleMapAnalyzeComplete}
            onSubmitAnalysis={handleAnalysisSubmit}
            onCreateUploadSession={handleCreateUploadSession}
            onUploadToTemporarySignedUrl={handleUploadToTemporarySignedUrl}
            enableRealAnalysis={realAnalysisEnabled}
            onCleanupTemporaryUpload={handleCleanupTemporaryUpload}
            onSubmitConfirmationAnswer={handleConfirmationAnswer}
            readingsSummary={
              accessState === "admin"
                ? null
                : accessState != null && !["free_unused", "free_preview_used"].includes(accessState)
                  ? { isPro: true, used: quota.usedThisMonth, limit: quota.proMonthlyLimit }
                  : { isPro: false, used: quota.usedTotal, limit: quota.freeTotalLimit }
            }
          />
        </>
      ) : (
        <MobileStrategicProfilePreview
          profile={profile}
          isRealShell={true}
          onSubmitAnalysis={handleAnalysisSubmit}
          onCreateUploadSession={handleCreateUploadSession}
          onUploadToTemporarySignedUrl={handleUploadToTemporarySignedUrl}
          enableRealAnalysis={realAnalysisEnabled}
          onCleanupTemporaryUpload={handleCleanupTemporaryUpload}
          onSubmitConfirmationAnswer={handleConfirmationAnswer}
          accessState={accessState}
          readingQuota={quota}
        />
      )}
    </div>
  );
}
