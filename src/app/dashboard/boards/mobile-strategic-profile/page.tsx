import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isMobileStrategicProfileEnabled } from "../videoUpload/mobileStrategicProfileFeatureFlag";
import { MobileStrategicProfileRealShellClient } from "../components/videoUpload/appPreview/MobileStrategicProfileRealShellClient";
import { DiagnosticoRealShellClient } from "../components/videoUpload/appPreview/DiagnosticoRealShellClient";
import DesktopRedirectGuard from "./DesktopRedirectGuard";
import { getStrategicProfileSnapshotByUserId } from "../videoUpload/mobileStrategicProfileSnapshotService";
import { buildNarrativeMapMobileViewModelFromReadings } from "../videoUpload/narrativeMapMobileViewModelServerSelector";
import { resolveDiagnosticoLeadingNarrativeSignal } from "../videoUpload/diagnosticoNarrativeSignals";
import { getNarrativeMapReadingQuotaForUser } from "../videoUpload/narrativeMapReadingQuotaService";
import { buildInstagramMetricsSummary } from "../videoUpload/instagramMetricsSummaryService";
import { getMapConfirmationsSnapshot } from "../videoUpload/mapConfirmationsService";
import { buildStreamBSignalsSummary } from "../videoUpload/streamBNarrativeSignalsService";
import { buildBrandMatchesFromConfirmedMap } from "../videoUpload/brandMatchingMobileService";
import { resolveMapEvolutionStatus } from "../videoUpload/mapEvolutionStatusResolver";
import { listContentIdeasForUser } from "../videoUpload/contentIdeasReadService";
import { evaluateContentIdeasReadiness } from "../videoUpload/contentIdeasReadinessGate";
import { getMapaSeedReadinessSource } from "../videoUpload/mapaSeedReadinessSource";
import { loadMapaSeedForSynthesisMerge, mergeMapaSeedIntoSynthesis } from "../videoUpload/mapaSeedSynthesisMerge";
import { buildAudienceInsights } from "../videoUpload/audienceInsightsService";
import { resolveFreshInstagramAvatar } from "@/app/lib/instagram/resolveFreshAvatar";
import {
  getNarrativeMapAccessLevelForUser,
  hasNarrativeMapInstagramConnection,
  hasNarrativeMapPremiumAccess,
  isNarrativeMapAdminUser,
  resolveNarrativeMapAccessState,
} from "../videoUpload/narrativeMapAccessState";
import type { NarrativeMapReadingQuotaSnapshot } from "../videoUpload/narrativeMapAccessState";
import type { DiagnosticoPageData } from "../videoUpload/diagnosticoPageData";
import { connectToDatabase } from "@/app/lib/mongoose";
import { normalizePlanStatus } from "@/utils/planStatus";
import type { MobileStrategicProfileSnapshotPayload } from "../videoUpload/mobileStrategicProfileSnapshotTypes";
import { getWeeklyMeetingExperience } from "@/app/lib/community/weeklyMeetingService";
import type { WeeklyMeetingProfileData } from "../components/videoUpload/appPreview/WeeklyMeetingProfileCard";

export const dynamic = "force-dynamic";

const DIAGNOSTICO_V2_ENABLED = process.env.DIAGNOSTICO_V2_ENABLED === "1";
const PERF_LOGGING_ENABLED =
  process.env.MOBILE_STRATEGIC_PROFILE_PERF_LOGGING_ENABLED === "1";

type ServerTimingMeasurements = Record<string, number>;

function serverNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

async function measureServerOperation<T>(
  measurements: ServerTimingMeasurements,
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = serverNow();
  try {
    return await operation();
  } finally {
    measurements[name] = Math.round((serverNow() - startedAt) * 10) / 10;
  }
}

// ── Production flag boot-check ─────────────────────────────────────────────
// Logs a warning at startup if any critical production feature flag is missing.
// Does NOT block rendering — only informs in server logs.
if (process.env.NODE_ENV === "production") {
  const REQUIRED_PROD_FLAGS = [
    "DIAGNOSTICO_V2_ENABLED",
    "VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED",
    "VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA",
  ] as const;
  for (const flag of REQUIRED_PROD_FLAGS) {
    const val = process.env[flag];
    if (!val || val === "0" || val === "false") {
      console.warn(
        `[MobileStrategicProfile] ⚠️  Production flag ${flag} is "${val ?? "(missing)"}". ` +
        `Set it to "1" or "true" to enable full functionality.`,
      );
    }
  }
}

type MobileStrategicProfilePageProps = {
  searchParams?: {
    state?: string | string[];
    affiliate?: string | string[];
  };
};

export default async function MobileStrategicProfilePage({
  searchParams,
}: MobileStrategicProfilePageProps) {
  const requestStartedAt = serverNow();
  const serverTimings: ServerTimingMeasurements = {};

  if (!isMobileStrategicProfileEnabled()) {
    notFound();
    return null;
  }

  const session = await measureServerOperation(
    serverTimings,
    "session",
    () => getServerSession(authOptions),
  );
  if (!session?.user) {
    const callbackUrl = encodeURIComponent("/dashboard/boards/mobile-strategic-profile");
    redirect(`/login?callbackUrl=${callbackUrl}&intent=strategic_profile`);
    return null;
  }

  const sessionUser = session.user as any;
  const userId: string = sessionUser?.id ?? "";

  let initialSnapshotPayload: MobileStrategicProfileSnapshotPayload | null = null;
  let initialNarrativeMapViewModel = null;
  let initialNarrativeMapPresentation = null;
  let initialReadingQuota: NarrativeMapReadingQuotaSnapshot | null = null;
  let diagnosticoPageData: DiagnosticoPageData | null = null;
  let weeklyMeeting: WeeklyMeetingProfileData | null = null;

  if (userId) {
    try {
      const isSnapshotEnabled = process.env.MOBILE_STRATEGIC_PROFILE_SNAPSHOT_ENABLED !== "0";
      const snapshotPromise = measureServerOperation(serverTimings, "snapshot", async () => {
        if (!isSnapshotEnabled) return null;
        try {
          const result = await getStrategicProfileSnapshotByUserId(userId);
          return result?.snapshot ?? null;
        } catch (err) {
          console.error("Erro silencioso ao ler snapshot estratégico no servidor:", err);
          return null;
        }
      });
      const readingQuotaPromise = measureServerOperation(
        serverTimings,
        "readingQuota",
        () => getNarrativeMapReadingQuotaForUser({ userId }),
      );
      const effectiveUserPromise = measureServerOperation(serverTimings, "freshUser", async () => {
        let effectiveUser = sessionUser;
        let mediaKitSlug: string | null = sessionUser?.mediaKitSlug ?? null;
        if (!DIAGNOSTICO_V2_ENABLED) return { effectiveUser, mediaKitSlug };

        // Read access fields fresh from DB. This bypasses the JWT/session cache so
        // direct admin/manual DB activations do not get mistaken for free accounts.
        try {
          await connectToDatabase();
          const { default: UserModelImport } = await import("@/app/models/User");
          const userDoc = await UserModelImport.findById(userId)
            .select("planStatus role cancelAtPeriodEnd mediaKitSlug isInstagramConnected instagramAccountId instagramAccessToken instagramUsername image name email lastMapVisitAt isNewUserForOnboarding onboardingCompletedAt onboardingAnswers weeklyMapSummary whatsappPhone whatsappVerified")
            .lean();
          if (userDoc) {
            mediaKitSlug = (userDoc as any).mediaKitSlug ?? null;
            effectiveUser = {
              ...sessionUser,
              name: (userDoc as any).name ?? sessionUser?.name,
              email: (userDoc as any).email ?? sessionUser?.email,
              image: (userDoc as any).image ?? sessionUser?.image,
              role: (userDoc as any).role ?? sessionUser?.role,
              planStatus: (userDoc as any).planStatus ?? sessionUser?.planStatus,
              cancelAtPeriodEnd: (userDoc as any).cancelAtPeriodEnd ?? sessionUser?.cancelAtPeriodEnd,
              instagramConnected:
                (userDoc as any).isInstagramConnected ?? sessionUser?.instagramConnected,
              isInstagramConnected:
                (userDoc as any).isInstagramConnected ?? sessionUser?.isInstagramConnected,
              instagramAccountId: (userDoc as any).instagramAccountId ?? sessionUser?.instagramAccountId,
              instagramAccessToken: (userDoc as any).instagramAccessToken ?? null,
              instagramUsername: (userDoc as any).instagramUsername ?? sessionUser?.instagramUsername,
              lastMapVisitAt: (userDoc as any).lastMapVisitAt ?? null,
              isNewUserForOnboarding: (userDoc as any).isNewUserForOnboarding ?? sessionUser?.isNewUserForOnboarding,
              onboardingCompletedAt: (userDoc as any).onboardingCompletedAt ?? null,
              onboardingAnswers: (userDoc as any).onboardingAnswers ?? null,
              weeklyMapSummary: (userDoc as any).weeklyMapSummary ?? null,
            };
          }
        } catch (err) {
          console.error("Erro silencioso ao buscar dados do usuário:", err);
        }
        return { effectiveUser, mediaKitSlug };
      });

      const [snapshotPayload, readingQuota, effectiveUserResult] = await Promise.all([
        snapshotPromise,
        readingQuotaPromise,
        effectiveUserPromise,
      ]);
      initialSnapshotPayload = snapshotPayload;
      initialReadingQuota = readingQuota;
      const { effectiveUser: effectiveUserForAccess, mediaKitSlug } = effectiveUserResult;

      const accessLevel = getNarrativeMapAccessLevelForUser(effectiveUserForAccess);
      const isInstagramConnected = hasNarrativeMapInstagramConnection(effectiveUserForAccess);
      const hasPremiumAccess = hasNarrativeMapPremiumAccess(effectiveUserForAccess);
      const isInternalAdmin = isNarrativeMapAdminUser(effectiveUserForAccess);

      const selectorPromise = measureServerOperation(serverTimings, "narrativeSelector", () =>
        buildNarrativeMapMobileViewModelFromReadings({
        userId,
        displayName: sessionUser?.name ?? "Creator",
        displayHandle: sessionUser?.instagramUsername ? `@${sessionUser.instagramUsername}` : null,
        accessLevel,
        instagramConnected: isInstagramConnected,
        mediaKitAvailable: Boolean(initialSnapshotPayload?.opportunities?.length),
      }));

      if (DIAGNOSTICO_V2_ENABLED) {
        // lastMapVisitAt is read from the fresh user doc; falls back to null for new users.
        const lastMapVisitAt: Date | null =
          ((effectiveUserForAccess as any).lastMapVisitAt instanceof Date)
            ? (effectiveUserForAccess as any).lastMapVisitAt
            : null;

        const mapConfirmationsPromise = measureServerOperation(
          serverTimings,
          "mapConfirmations",
          () => getMapConfirmationsSnapshot(userId),
        );
        const instagramMetricsPromise = measureServerOperation(
          serverTimings,
          "instagramMetrics",
          () => isInstagramConnected
            ? buildInstagramMetricsSummary(userId).catch(() => null)
            : Promise.resolve(null),
        );
        const streamBSignalsPromise = measureServerOperation(
          serverTimings,
          "streamBSignals",
          () => isInstagramConnected
            ? buildStreamBSignalsSummary(userId, lastMapVisitAt)
            : Promise.resolve(null),
        );
        const contentIdeasPromise = measureServerOperation(
          serverTimings,
          "contentIdeas",
          () => listContentIdeasForUser(userId),
        );
        const mapaSeedSourcePromise = measureServerOperation(
          serverTimings,
          "mapaSeedReadiness",
          () => getMapaSeedReadinessSource(userId),
        );
        const mapaSeedForMergePromise = measureServerOperation(
          serverTimings,
          "mapaSeedMergeSource",
          () => loadMapaSeedForSynthesisMerge(userId).catch(() => null),
        );
        const fullMapaSeedPromise = measureServerOperation(serverTimings, "fullMapaSeed", async () => {
          try {
            const { default: MapaSeedModelImport } = await import("@/app/models/MapaSeed");
            const doc = await MapaSeedModelImport.findOne({ userId })
              .select("mapa")
              .lean<{ mapa?: any } | null>();
            return (doc?.mapa ?? null) as import("@/app/models/MapaSeed").IMapaData | null;
          } catch {
            return null;
          }
        });
        const avatarPromise = measureServerOperation(serverTimings, "instagramAvatar", () =>
          resolveFreshInstagramAvatar({
            userId,
            currentImage: (effectiveUserForAccess as any)?.image ?? null,
            instagramAccountId: (effectiveUserForAccess as any)?.instagramAccountId ?? null,
            instagramAccessToken: (effectiveUserForAccess as any)?.instagramAccessToken ?? null,
          }));
        const audienceInsightsPromise = measureServerOperation(
          serverTimings,
          "audienceInsights",
          async () => {
            if (!isInstagramConnected) return null;
            const selector = await selectorPromise;
            return buildAudienceInsights(userId, {
              confirmedTerritoryLabels: (selector.profileSynthesis.narrativeTerritories ?? [])
                .map((territory) => territory.label),
            }).catch((err) => {
              console.error("[mobile-strategic-profile] buildAudienceInsights falhou:", err);
              return null;
            });
          },
        );
        const brandMatchesPromise = measureServerOperation(serverTimings, "brandMatches", async () => {
          const [selector, confirmations] = await Promise.all([
            selectorPromise,
            mapConfirmationsPromise,
          ]);
          return buildBrandMatchesFromConfirmedMap(
            selector.profileSynthesis,
            confirmations,
          ).catch(() => ({ matches: selector.brandMatches ?? [], confirmedMap: false }));
        });

        const [
          selectorResult,
          instagramMetrics,
          mapConfirmations,
          streamBSignalsSummary,
          contentIdeas,
          audienceInsights,
          mapaSeedSource,
          mapaSeedForMerge,
          fullMapaSeedDoc,
          resolvedAvatarUrl,
          brandMatchResult,
        ] = await Promise.all([
          selectorPromise,
          instagramMetricsPromise,
          mapConfirmationsPromise,
          streamBSignalsPromise,
          contentIdeasPromise,
          audienceInsightsPromise,
          mapaSeedSourcePromise,
          mapaSeedForMergePromise,
          fullMapaSeedPromise,
          avatarPromise,
          brandMatchesPromise,
        ]);
        initialNarrativeMapViewModel = selectorResult.viewModel;
        initialNarrativeMapPresentation = selectorResult.currentPresentation;
        const { matches: brandMatches, confirmedMap: brandMapConfirmed } = brandMatchResult;
        // Pautas are Pro-only. For non-premium users, mark as not ready with the
        // premiumRequired flag so the UI shows an upgrade prompt instead of a
        // retry button that will always fail with 403.
        //
        // V2: synthesis data is accepted as a fallback for explicit confirmation —
        // creators who filled in their map via onboarding (MapaSeed) but never went
        // through the confirmation UX flow should not be blocked.
        const synthesis = selectorResult.profileSynthesis;
        // Fase 2C — o MapaSeed (onboarding + Instagram) também é fonte de
        // narrativa/territórios para a prontidão das pautas, ao lado da síntese de
        // vídeo. Mantém o card de pautas coerente com o gate da rota de geração.
        const synthesisHasNarrative = !!(synthesis.mainNarrative?.label) || mapaSeedSource.hasNarrative;
        const synthesisHasTerritories = (synthesis.narrativeTerritories?.length ?? 0) > 0 || mapaSeedSource.hasTerritories;
        const contentIdeasReadiness = evaluateContentIdeasReadiness(mapConfirmations, synthesisHasNarrative, synthesisHasTerritories);

        // Derive billing flags from planStatus — mirrors useBillingStatus.ts logic so the
        // server-rendered page shows the correct "payment_pending" / "payment_action_needed"
        // state instead of silently treating billing-failed users as free accounts.
        const normalizedPlanStatus = normalizePlanStatus(effectiveUserForAccess.planStatus);
        const needsPaymentUpdate =
          normalizedPlanStatus === "past_due" || normalizedPlanStatus === "unpaid";
        const needsCheckout =
          normalizedPlanStatus === "incomplete" || normalizedPlanStatus === "pending";

        const accessState = resolveNarrativeMapAccessState({
          isAdmin: isInternalAdmin,
          hasPremiumAccess,
          hasFullReportAccess: hasPremiumAccess,
          needsCheckout: !isInternalAdmin && needsCheckout,
          needsPaymentAction: !isInternalAdmin && (needsPaymentUpdate || needsCheckout),
          needsPaymentUpdate: !isInternalAdmin && needsPaymentUpdate,
          instagram: { connected: isInstagramConnected },
          readingQuota: initialReadingQuota,
        });
        // Sem prioridade de fonte: o MapaSeed (onboarding + Instagram) alimenta o
        // card "Seu Mapa" igual ao vídeo. Funde narrativa/territórios/tom/assets na
        // síntese que o card renderiza — assim quem conecta o Instagram (sem subir
        // vídeo) vê o mapa, não só as pautas. Gate e brand matching seguem na síntese
        // crua (já tratam o MapaSeed à parte / marcas não devem mudar de comportamento).
        const mergedSynthesis = mergeMapaSeedIntoSynthesis(selectorResult.profileSynthesis, mapaSeedForMerge);
        const leadingNarrative = resolveDiagnosticoLeadingNarrativeSignal(mergedSynthesis);

        // Pautas desatualizadas: o mapa foi enriquecido (Instagram/vídeo) DEPOIS da
        // última pauta gerada → elas refletem um mapa mais "magro". O shell usa isto
        // para auto-regenerar uma vez. Sinal por timestamp (não por hash) porque há
        // dois geradores de pautas com funções de hash distintas — comparar hash daria
        // falso-positivo permanente. Dispara só uma vez: a nova pauta fica mais recente
        // que o enriquecimento.
        const lastEnrichedAt = mapaSeedSource.lastEnrichedAt;
        const latestIdeaAt = contentIdeas[0]?.generatedAt ? new Date(contentIdeas[0].generatedAt) : null;
        const contentIdeasMapStale =
          contentIdeas.length > 0 &&
          !!lastEnrichedAt &&
          !!latestIdeaAt &&
          lastEnrichedAt.getTime() > latestIdeaAt.getTime();

        // Detect first-time users who need the guided onboarding flow.
        // Only triggers when both flags are set — preserves existing users.
        const needsOnboarding =
          (effectiveUserForAccess as any).isNewUserForOnboarding === true &&
          !(effectiveUserForAccess as any).onboardingCompletedAt;

        diagnosticoPageData = {
          synthesis: mergedSynthesis,
          instagramMetrics,
          readings: selectorResult.viewModel.readings.items,
          mainNarrativeLabel: leadingNarrative?.label ?? null,
          profileSynthesisStatus: mergedSynthesis.status,
          accessState,
          readingQuota: initialReadingQuota,
          instagramConnected: isInstagramConnected,
          brandMatches,
          brandMapConfirmed,
          mapConfirmations,
          needsOnboarding,
          streamBSignalsSummary,
          mapEvolutionStatus: resolveMapEvolutionStatus(
            mergedSynthesis.status,
            mapConfirmations,
          ),
          contentIdeas,
          contentIdeasReadiness,
          contentIdeasMapStale,
          audienceInsights: audienceInsights ?? null,
          mapaSeed: fullMapaSeedDoc,
          userInfo: (() => {
            const profile = (effectiveUserForAccess as any).creatorProfileExtended ?? {};
            const hasNiches = Array.isArray(profile.niches) && profile.niches.length > 0;
            const hasGoal = Boolean(profile.mainGoal3m);
            const mapProfileIncomplete = !hasNiches || !hasGoal;
            const pricingProfileIncomplete = !profile.hasDoneSponsoredPosts;
            return {
              name: effectiveUserForAccess?.name ?? null,
              email: effectiveUserForAccess?.email ?? null,
              handle: effectiveUserForAccess?.instagramUsername ?? null,
              imageUrl: resolvedAvatarUrl,
              plan: hasPremiumAccess ? "Pro" : "Free",
              mediaKitSlug,
              whatsappLinked: !!(effectiveUserForAccess as any).whatsappPhone && !!(effectiveUserForAccess as any).whatsappVerified,
              mapProfileIncomplete,
              pricingProfileIncomplete,
            };
          })(),
          onboardingAnswers: (() => {
            const oa = (effectiveUserForAccess as any).onboardingAnswers;
            if (!oa) return null;
            return {
              whyYouCreate: oa.whyYouCreate ?? null,
              desiredFeeling: oa.desiredFeeling ?? null,
              contentLimit: oa.contentLimit ?? null,
              creatorPurpose: oa.creatorPurpose ?? null,
            };
          })(),
          weeklyMapSummary: (effectiveUserForAccess as any).weeklyMapSummary ?? null,
        };
      } else {
        const selectorResult = await selectorPromise;
        initialNarrativeMapViewModel = selectorResult.viewModel;
        initialNarrativeMapPresentation = selectorResult.currentPresentation;
      }
    } catch (err) {
      console.error("Erro silencioso ao montar mapa narrativo mobile:", err);
    }
  }

  if (DIAGNOSTICO_V2_ENABLED && diagnosticoPageData) {
    try {
      const meeting = await measureServerOperation(
        serverTimings,
        "weeklyMeeting",
        () => getWeeklyMeetingExperience(),
      );
      weeklyMeeting = {
        startAt: meeting.startAt.toISOString(),
        status: meeting.status,
      };
    } catch (err) {
      console.error("Erro silencioso ao carregar a reunião semanal no Perfil:", err);
    }
  }

  serverTimings.total = Math.round((serverNow() - requestStartedAt) * 10) / 10;
  if (PERF_LOGGING_ENABLED) {
    console.info("[mobile-strategic-profile][server-timing]", {
      diagnosticoV2: DIAGNOSTICO_V2_ENABLED,
      timingsMs: serverTimings,
    });
  }

  const stateQuery = typeof searchParams?.state === "string" ? searchParams.state : null;
  const initialAffiliateView = searchParams?.affiliate === "1";

  if (DIAGNOSTICO_V2_ENABLED && diagnosticoPageData) {
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-zinc-50" />}>
        <DesktopRedirectGuard />
        <DiagnosticoRealShellClient
          data={diagnosticoPageData}
          onAnalyzeAction={null}
          weeklyMeeting={weeklyMeeting}
        />
      </Suspense>
    );
  }

  return (
    <>
      <DesktopRedirectGuard />
      <MobileStrategicProfileRealShellClient
        session={session}
        stateQuery={stateQuery}
        initialSnapshotPayload={initialSnapshotPayload}
        initialNarrativeMapViewModel={initialNarrativeMapViewModel}
        initialNarrativeMapPresentation={initialNarrativeMapPresentation}
        initialReadingQuota={initialReadingQuota}
        initialAffiliateView={initialAffiliateView}
      />
    </>
  );
}
