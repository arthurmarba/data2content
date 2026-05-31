import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isRealUploadEnabled,
  isTemporaryUploadSessionEnabled,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag";
import { isVideoNarrativeRealAnalysisE2EEnabled } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisFeatureFlag";
import { validateVideoNarrativeRealAnalysisPayload } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisTypes";
import { runVideoNarrativeRealAnalysisOrchestrator } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisOrchestrator";
import { validateVideoNarrativeTemporaryUploadCleanupPayload } from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadCleanupTypes";
import { buildInstagramMetricsSummary } from "@/app/dashboard/boards/videoUpload/instagramMetricsSummaryService";
import { listRecentCreatorVideoNarrativeDiagnosesForUser } from "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisReadService";
import type { VideoNarrativeInstagramMetricsSummary } from "@/app/dashboard/boards/videoUpload/videoNarrativeAiProviderTypes";
import {
  deleteLocalVideoNarrativeTemporaryUpload,
  isLocalVideoNarrativeTemporaryUploadEnabled,
  isLocalVideoNarrativeUploadSessionId,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeLocalTemporaryUploadStore";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import {
  hasNarrativeMapInstagramConnection,
  hasNarrativeMapPremiumAccess,
  isNarrativeMapAdminUser,
  type NarrativeMapAccessState,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import { assertCanStartNarrativeMapReading } from "@/app/dashboard/boards/videoUpload/narrativeMapReadingQuotaService";
import type {
  VideoNarrativeRealAnalysisUsagePolicy,
  VideoNarrativeRealAnalysisUsageTier,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisUsagePolicy";
import type { VideoNarrativeRealAnalysisUsageSnapshot } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisUsageService";

type MobileStrategicProfileRealAnalysisSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
    isAdmin?: boolean | null;
    isDev?: boolean | null;
    planStatus?: string | null;
    instagramConnected?: boolean | null;
    isInstagramConnected?: boolean | null;
  };
} | null;
type MobileStrategicProfileRealAnalysisUser = NonNullable<
  NonNullable<MobileStrategicProfileRealAnalysisSession>["user"]
>;

function safeResponseCode(code: string | undefined): string | undefined {
  return code?.replace(/gemini/gi, "provider");
}

function buildLocalRealAnalysisUsagePolicy(sizeBytes: number) {
  return {
    tier: "admin_dev" as const,
    dailyLimit: 999,
    monthlyLimit: 999,
    maxFileSizeBytes: Math.max(sizeBytes, 100 * 1024 * 1024),
    cooldownSeconds: 0,
    allowRealAnalysis: true,
  };
}

function buildLocalRealAnalysisUsageSnapshot(
  userId: string,
  now: Date,
): VideoNarrativeRealAnalysisUsageSnapshot {
  return {
    userId,
    dateKey: now.toISOString().slice(0, 10),
    monthKey: now.toISOString().slice(0, 7),
    dailyCount: 0,
    monthlyCount: 0,
    lastAttemptAt: now,
    lastSuccessAt: null,
    lastFailureAt: null,
  };
}

function buildNarrativeMapRealAnalysisAccess(user: MobileStrategicProfileRealAnalysisUser) {
  const isAdmin = isNarrativeMapAdminUser(user);
  const hasPremiumAccess = isAdmin || hasNarrativeMapPremiumAccess(user);

  return {
    isAdmin,
    hasPremiumAccess,
    hasFullReportAccess: hasPremiumAccess,
    instagram: {
      connected: hasNarrativeMapInstagramConnection(user),
      needsReconnect: false,
    },
  };
}

function resolveEntitlementUsageTier(state: NarrativeMapAccessState): VideoNarrativeRealAnalysisUsageTier {
  if (state === "admin") return "admin_dev";
  if (state === "free_unused") return "free";
  return "premium";
}

function buildNarrativeMapEntitlementRealAnalysisPolicy(
  state: NarrativeMapAccessState,
  sizeBytes: number,
): VideoNarrativeRealAnalysisUsagePolicy {
  const tier = resolveEntitlementUsageTier(state);

  return {
    tier,
    dailyLimit: tier === "admin_dev" ? 999 : tier === "free" ? 1 : 10,
    monthlyLimit: tier === "admin_dev" ? 999 : tier === "free" ? 1 : 10,
    maxFileSizeBytes: Math.max(sizeBytes, 100 * 1024 * 1024),
    cooldownSeconds: tier === "admin_dev" ? 0 : tier === "free" ? 120 : 60,
    allowRealAnalysis: true,
  };
}

async function resolveRealAnalysisUser(
  sessionUser: MobileStrategicProfileRealAnalysisUser,
): Promise<MobileStrategicProfileRealAnalysisUser> {
  if (!sessionUser?.id || hasNarrativeMapPremiumAccess(sessionUser)) {
    return sessionUser;
  }

  const planAccess = await ensurePlannerAccess({
    session: { user: sessionUser } as any,
    userId: sessionUser.id,
    email: sessionUser.email ?? undefined,
    allowAdmin: true,
    forceReload: true,
    routePath: "/api/dashboard/mobile-strategic-profile/analyze-real",
  });

  if (planAccess.ok && planAccess.normalizedStatus) {
    return {
      ...sessionUser,
      planStatus: planAccess.normalizedStatus,
    };
  }

  return sessionUser;
}

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function POST(request: Request) {
  try {
    if (
      !isMobileStrategicProfileEnabled() ||
      !isTemporaryUploadSessionEnabled() ||
      !isRealUploadEnabled() ||
      !isVideoNarrativeRealAnalysisE2EEnabled()
    ) {
      return NextResponse.json(
        { message: "Análise real de vídeo indisponível nesta configuração." },
        { status: 403 },
      );
    }

    const session = (await getServerSession(await resolveAuthOptions())) as MobileStrategicProfileRealAnalysisSession;
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Acesso não autorizado: sessão não identificada." },
        { status: 401 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { message: "Content-type inválido: deve ser application/json." },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Payload inválido: formato JSON corrompido." }, { status: 400 });
    }

    const validation = validateVideoNarrativeRealAnalysisPayload(body);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, message: validation.message, code: validation.code }, { status: 400 });
    }

    const localRealAnalysisEnabled =
      isLocalVideoNarrativeTemporaryUploadEnabled() &&
      isLocalVideoNarrativeUploadSessionId(validation.payload.uploadSessionId);
    const analysisUser = await resolveRealAnalysisUser(session.user);
    const accessDecision = await assertCanStartNarrativeMapReading({
      userId: session.user.id,
      access: buildNarrativeMapRealAnalysisAccess(analysisUser),
    });

    if (!accessDecision.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: "reading_quota_unavailable",
          accessState: accessDecision.state,
          quota: accessDecision.quota,
          message: accessDecision.message,
        },
        { status: 403 },
      );
    }

    // Fetch Instagram metrics + recent readings in parallel to enrich the Gemini prompt.
    // Both are non-blocking: failures degrade gracefully (null / empty array).
    const [rawInstagramMetrics, recentReadings] = await Promise.all([
      buildInstagramMetricsSummary(session.user.id).catch(() => null),
      listRecentCreatorVideoNarrativeDiagnosesForUser({ userId: session.user.id, limit: 4 }).catch(() => []),
    ]);

    // Map the rich InstagramMetricsSummary to the provider-facing type, including
    // new fields (watch time, intent signals, deltas, best day) added in this optimization pass.
    const instagramMetrics: VideoNarrativeInstagramMetricsSummary | null = rawInstagramMetrics
      ? {
          postsAnalyzed: rawInstagramMetrics.postsAnalyzed,
          avgReachPerPost: rawInstagramMetrics.avgReachPerPost,
          avgEngagementRate: rawInstagramMetrics.avgEngagementRate,
          avgReelsDurationSeconds: rawInstagramMetrics.avgReelsDurationSeconds,
          avgReelsWatchTimeSeconds: rawInstagramMetrics.avgReelsWatchTimeSeconds,
          avgReelsViews: rawInstagramMetrics.avgReelsViews,
          avgSavesPerPost: rawInstagramMetrics.avgSavesPerPost,
          avgSharesPerPost: rawInstagramMetrics.avgSharesPerPost,
          avgCommentsPerPost: rawInstagramMetrics.avgCommentsPerPost,
          avgIntentActionsPerPost: rawInstagramMetrics.avgIntentActionsPerPost,
          topFormats: rawInstagramMetrics.topFormats ?? undefined,
          bestDayLabel: rawInstagramMetrics.bestDayOfWeek?.dayLabel ?? null,
          bestDayAvgReach: rawInstagramMetrics.bestDayOfWeek?.avgReach ?? null,
          reachDelta: rawInstagramMetrics.deltas?.avgReachPerPost ?? null,
          engagementDelta: rawInstagramMetrics.deltas?.avgEngagementRate ?? null,
          intentDelta: rawInstagramMetrics.deltas?.avgIntentActionsPerPost ?? null,
        }
      : null;

    // Extract known narrative labels from the most recent readings so Gemini can
    // detect confirmations vs. deviations against the creator's established pattern.
    const knownNarratives = [
      ...new Set(
        recentReadings
          .map((r) => r.videoReading.mainNarrative?.trim())
          .filter((v): v is string => Boolean(v)),
      ),
    ];

    // Build confirmed life assets from contentContext across recent readings.
    // Each unique life signal (setting, socialPresence, emotionalRegister, lifeSignals items)
    // is counted across readings. Sorted by frequency so Gemini sees the strongest pattern first.
    const confirmedLifeAssets = (() => {
      const counts = new Map<string, number>();
      for (const r of recentReadings) {
        const ctx = r.contentContext;
        if (!ctx) continue;
        const signals = [
          ctx.setting,
          ctx.socialPresence,
          ctx.emotionalRegister,
          ...(ctx.lifeSignals ?? []),
        ].filter((v): v is string => Boolean(v?.trim()));
        for (const signal of signals) {
          counts.set(signal, (counts.get(signal) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, evidenceCount]) => ({ label, evidenceCount }));
    })();
    const topPerformingPattern = confirmedLifeAssets[0]?.label ?? null;

    // Collect confirmation quiz answers from recent readings, deduplicating by
    // questionId (most recent reading wins). This gives Gemini a direct signal
    // of what the creator has expressed about their own content.
    const pastCreatorAnswers = (() => {
      const seen = new Set<string>();
      const answers: Array<{ questionText: string; answerValue: string }> = [];
      for (const r of recentReadings) {
        const quizAnswers = r.confirmationQuizAnswers;
        if (!Array.isArray(quizAnswers)) continue;
        for (const a of quizAnswers) {
          if (
            typeof a?.questionId !== "string" ||
            typeof a?.questionText !== "string" ||
            typeof a?.answerValue !== "string" ||
            seen.has(a.questionId)
          ) continue;
          seen.add(a.questionId);
          answers.push({
            questionText: a.questionText.trim().slice(0, 200),
            answerValue: a.answerValue.trim().slice(0, 200),
          });
        }
      }
      return answers;
    })();

    const localEnv = localRealAnalysisEnabled
      ? {
          ...process.env,
          VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
        }
      : undefined;
    const entitlementPolicy = buildNarrativeMapEntitlementRealAnalysisPolicy(
      accessDecision.state,
      validation.payload.temporaryUpload?.sizeBytes ?? 0,
    );
    const realAnalysisPayload = {
      ...validation.payload,
      persistReading: true,
      persistSynthesisSnapshot: true,
    };

    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload: realAnalysisPayload,
      user: localRealAnalysisEnabled
        ? {
            ...analysisUser,
            isDev: true,
            role: analysisUser.role ?? "dev",
          }
        : analysisUser,
      deps: {
        env: localEnv,
        instagramMetrics,
        knownNarratives: knownNarratives.length > 0 ? knownNarratives : null,
        confirmedLifeAssets: confirmedLifeAssets.length > 0 ? confirmedLifeAssets : null,
        topPerformingPattern: topPerformingPattern || null,
        pastCreatorAnswers: pastCreatorAnswers.length > 0 ? pastCreatorAnswers : null,
        evaluateAllowlist: () => ({ ok: true, reason: "narrative_map_entitlement" }),
        assertCanRunRealAnalysis: localRealAnalysisEnabled
          ? async () => ({
              ok: true,
              tier: "admin_dev",
              policy: buildLocalRealAnalysisUsagePolicy(validation.payload.temporaryUpload?.sizeBytes ?? 0),
            })
          : async () => ({
              ok: true,
              tier: entitlementPolicy.tier,
              policy: entitlementPolicy,
            }),
        recordUsageAttempt: localRealAnalysisEnabled
          ? async ({ userId, now }) => buildLocalRealAnalysisUsageSnapshot(userId, now ?? new Date())
          : undefined,
        recordUsageSuccess: localRealAnalysisEnabled ? async () => undefined : undefined,
        recordUsageFailure: localRealAnalysisEnabled ? async () => undefined : undefined,
        cleanupTemporaryUpload: async ({ uploadSessionId, objectKey, reason }) => {
          const cleanupValidation = validateVideoNarrativeTemporaryUploadCleanupPayload({
            uploadSessionId,
            objectKey,
            reason,
          });
          if (!cleanupValidation.ok) {
            throw new Error("cleanup_payload_rejected");
          }
          if (localRealAnalysisEnabled && reason !== "analysis_failed") {
            await deleteLocalVideoNarrativeTemporaryUpload({ sessionId: uploadSessionId });
          }
        },
      },
    });

    if (!result.ok) {
      const status = result.status === "blocked" ? 403 : 502;
      return NextResponse.json(
        {
          ok: false,
          message: result.message,
          code: safeResponseCode(result.safeIssueCode),
          videoReadingPersistence: result.videoReadingPersistence,
          synthesisSnapshotWrite: result.synthesisSnapshotWrite,
          e2eBetaAudit: {
            realAnalysis: false,
            evidenceAnchorsUsed: Boolean(result.evidenceAnchorsUsed),
            cleanupAttempted: Boolean(result.cleanupAttempted),
            usageLimitChecked: Boolean(result.usageLimitChecked),
            allowlistGatePassed: Boolean(result.allowlistGatePassed),
          },
          cleanupWarning: result.cleanupWarning,
        },
        { status },
      );
    }

    const e2eBetaAudit = {
      realAnalysis: result.realAnalysis,
      evidenceAnchorsUsed: result.evidenceAnchorsUsed,
      cleanupAttempted: result.cleanupAttempted,
      usageLimitChecked: result.usageLimitChecked,
      allowlistGatePassed: result.allowlistGatePassed,
    };

    if (!result.evidenceAnchorsUsed) {
      return NextResponse.json(
        {
          ok: false,
          message: "Não conseguimos encontrar evidências suficientes no vídeo. Tente enviar o vídeo novamente ou escolha outro conteúdo.",
          code: "video_evidence_missing",
          videoReadingPersistence: result.videoReadingPersistence,
          synthesisSnapshotWrite: result.synthesisSnapshotWrite,
          e2eBetaAudit,
          cleanupWarning: result.cleanupWarning,
        },
        { status: 502 },
      );
    }

    if (realAnalysisPayload.persistReading === true && !result.videoReadingPersistence?.saved) {
      return NextResponse.json(
        {
          ok: false,
          message: "A leitura foi gerada, mas não foi salva no Perfil. Tente novamente.",
          code: "reading_not_saved",
          videoReadingPersistence: result.videoReadingPersistence,
          synthesisSnapshotWrite: result.synthesisSnapshotWrite,
          e2eBetaAudit,
          cleanupWarning: result.cleanupWarning,
        },
        { status: 502 },
      );
    }

    if (realAnalysisPayload.persistSynthesisSnapshot === true && !result.synthesisSnapshotWrite?.written) {
      return NextResponse.json(
        {
          ok: false,
          message: "A leitura foi salva, mas o Perfil não foi atualizado agora. Tente novamente em alguns minutos.",
          code: "profile_synthesis_not_written",
          videoReadingPersistence: result.videoReadingPersistence,
          synthesisSnapshotWrite: result.synthesisSnapshotWrite,
          e2eBetaAudit,
          cleanupWarning: result.cleanupWarning,
        },
        { status: 502 },
      );
    }

    // Monta snapshot para a tela de confirmação pós-análise
    const persisted = result.videoReadingPersistence;
    const synthWrite = result.synthesisSnapshotWrite;
    const readingCount = synthWrite?.analyzedReadingsCount ?? 1;
    const synthStatus = synthWrite?.synthesisStatus ?? "signals_emerging";

    const synthStatusLabel: Record<string, string> = {
      first_reading:        "Primeira leitura registrada",
      signals_emerging:     "Sinais surgindo",
      pattern_in_formation: "Padrões em formação",
      profile_consistent:   "Perfil consistente",
    };

    const snapshot =
      persisted?.saved && persisted?.diagnosisId
        ? {
            diagnosisSummary:
              readingCount === 1
                ? "Primeira análise registrada. Seu Perfil estratégico começou a se formar."
                : `${readingCount}ª análise registrada. ${synthStatusLabel[synthStatus] ?? "Perfil em construção"}.`,
            unlockedSignals: [],
            opportunities: [],
          }
        : null;

    return NextResponse.json({
      ok: true,
      snapshot,
      videoReadingPersistence: result.videoReadingPersistence,
      synthesisSnapshotWrite: result.synthesisSnapshotWrite,
      e2eBetaAudit,
      adaptiveQuiz: result.adaptiveQuiz,
      cleanupWarning: result.cleanupWarning,
    });
  } catch {
    return NextResponse.json(
      { message: "Ocorreu um erro ao processar a análise real do diagnóstico." },
      { status: 500 },
    );
  }
}
