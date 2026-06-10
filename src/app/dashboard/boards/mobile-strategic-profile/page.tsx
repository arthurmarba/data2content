import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isMobileStrategicProfileEnabled } from "../videoUpload/mobileStrategicProfileFeatureFlag";
import { MobileStrategicProfileRealShellClient } from "../components/videoUpload/appPreview/MobileStrategicProfileRealShellClient";
import { DiagnosticoRealShellClient } from "../components/videoUpload/appPreview/DiagnosticoRealShellClient";
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

export const dynamic = "force-dynamic";

const DIAGNOSTICO_V2_ENABLED = process.env.DIAGNOSTICO_V2_ENABLED === "1";

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
  };
};

export default async function MobileStrategicProfilePage({
  searchParams,
}: MobileStrategicProfilePageProps) {
  if (!isMobileStrategicProfileEnabled()) {
    notFound();
    return null;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const callbackUrl = encodeURIComponent("/dashboard/boards/mobile-strategic-profile");
    redirect(`/login?callbackUrl=${callbackUrl}&intent=strategic_profile`);
    return null;
  }

  const sessionUser = session.user as any;
  const userId: string = sessionUser?.id ?? "";

  let initialSnapshotPayload = null;
  let initialNarrativeMapViewModel = null;
  let initialNarrativeMapPresentation = null;
  let initialReadingQuota: NarrativeMapReadingQuotaSnapshot | null = null;
  let diagnosticoPageData: DiagnosticoPageData | null = null;

  const isSnapshotEnabled = process.env.MOBILE_STRATEGIC_PROFILE_SNAPSHOT_ENABLED !== "0";
  if (isSnapshotEnabled && userId) {
    try {
      const result = await getStrategicProfileSnapshotByUserId(userId);
      if (result?.snapshot) initialSnapshotPayload = result.snapshot;
    } catch (err) {
      console.error("Erro silencioso ao ler snapshot estratégico no servidor:", err);
    }
  }

  if (userId) {
    try {
      let effectiveUserForAccess = sessionUser;
      let mediaKitSlug: string | null = sessionUser?.mediaKitSlug ?? null;

      if (DIAGNOSTICO_V2_ENABLED) {
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
            effectiveUserForAccess = {
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
              // Selecionados na query acima, mas precisam ser carregados explicitamente
              // aqui — senão a leitura abaixo cai no sessionUser (token), que não os tem.
              onboardingAnswers: (userDoc as any).onboardingAnswers ?? null,
              weeklyMapSummary: (userDoc as any).weeklyMapSummary ?? null,
            };
          }
        } catch (err) {
          console.error("Erro silencioso ao buscar dados do usuário:", err);
        }
      }

      const accessLevel = getNarrativeMapAccessLevelForUser(effectiveUserForAccess);
      const isInstagramConnected = hasNarrativeMapInstagramConnection(effectiveUserForAccess);
      const hasPremiumAccess = hasNarrativeMapPremiumAccess(effectiveUserForAccess);
      const isInternalAdmin = isNarrativeMapAdminUser(effectiveUserForAccess);

      initialReadingQuota = await getNarrativeMapReadingQuotaForUser({ userId });

      const selectorResult = await buildNarrativeMapMobileViewModelFromReadings({
        userId,
        displayName: sessionUser?.name ?? "Creator",
        displayHandle: sessionUser?.instagramUsername ? `@${sessionUser.instagramUsername}` : null,
        accessLevel,
        instagramConnected: isInstagramConnected,
        mediaKitAvailable: Boolean(initialSnapshotPayload?.opportunities?.length),
      });

      initialNarrativeMapViewModel = selectorResult.viewModel;
      initialNarrativeMapPresentation = selectorResult.currentPresentation;

      if (DIAGNOSTICO_V2_ENABLED) {
        // lastMapVisitAt is read from the fresh user doc; falls back to null for new users.
        const lastMapVisitAt: Date | null =
          ((effectiveUserForAccess as any).lastMapVisitAt instanceof Date)
            ? (effectiveUserForAccess as any).lastMapVisitAt
            : null;

        const [instagramMetrics, mapConfirmations, streamBSignalsSummary, contentIdeas, audienceInsights] = await Promise.all([
          isInstagramConnected
            ? buildInstagramMetricsSummary(userId).catch(() => null)
            : Promise.resolve(null),
          getMapConfirmationsSnapshot(userId),
          isInstagramConnected
            ? buildStreamBSignalsSummary(userId, lastMapVisitAt)
            : Promise.resolve(null),
          listContentIdeasForUser(userId),
          isInstagramConnected
            ? buildAudienceInsights(userId, {
                confirmedTerritoryLabels: (selectorResult.profileSynthesis.narrativeTerritories ?? [])
                  .map((t) => t.label),
              }).catch(() => null)
            : Promise.resolve(null),
        ]);
        // Pautas are Pro-only. For non-premium users, mark as not ready with the
        // premiumRequired flag so the UI shows an upgrade prompt instead of a
        // retry button that will always fail with 403.
        //
        // V2: synthesis data is accepted as a fallback for explicit confirmation —
        // creators who filled in their map via onboarding (MapaSeed) but never went
        // through the confirmation UX flow should not be blocked.
        const synthesis = selectorResult.profileSynthesis;
        const synthesisHasNarrative = !!(synthesis.mainNarrative?.label);
        const synthesisHasTerritories = (synthesis.narrativeTerritories?.length ?? 0) > 0;
        const contentIdeasReadiness = (!hasPremiumAccess && !isInternalAdmin)
          ? {
              ready: false as const,
              missingDimensions: [] as ReturnType<typeof evaluateContentIdeasReadiness>["missingDimensions"],
              nextStep: null,
              premiumRequired: true as const,
            }
          : evaluateContentIdeasReadiness(mapConfirmations, synthesisHasNarrative, synthesisHasTerritories);

        // Brand matching — uses confirmed map as primary signal when narrative is confirmed;
        // falls back to synthesis-based matching for creators who haven't confirmed yet.
        const { matches: brandMatches, confirmedMap: brandMapConfirmed } =
          await buildBrandMatchesFromConfirmedMap(
            selectorResult.profileSynthesis,
            mapConfirmations,
          ).catch(() => ({ matches: selectorResult.brandMatches ?? [], confirmedMap: false }));

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
        const leadingNarrative = resolveDiagnosticoLeadingNarrativeSignal(selectorResult.profileSynthesis);

        // Detect first-time users who need the guided onboarding flow.
        // Only triggers when both flags are set — preserves existing users.
        const needsOnboarding =
          (effectiveUserForAccess as any).isNewUserForOnboarding === true &&
          !(effectiveUserForAccess as any).onboardingCompletedAt;

        // Avatar do IG: URLs do CDN do FB expiram (~4,5 dias). Re-busca sob demanda
        // se estiver perto de expirar (best-effort, nunca quebra a página).
        const resolvedAvatarUrl = await resolveFreshInstagramAvatar({
          userId,
          currentImage: (effectiveUserForAccess as any)?.image ?? null,
          instagramAccountId: (effectiveUserForAccess as any)?.instagramAccountId ?? null,
          instagramAccessToken: (effectiveUserForAccess as any)?.instagramAccessToken ?? null,
        });

        diagnosticoPageData = {
          synthesis: selectorResult.profileSynthesis,
          instagramMetrics,
          readings: selectorResult.viewModel.readings.items,
          mainNarrativeLabel: leadingNarrative?.label ?? null,
          profileSynthesisStatus: selectorResult.profileSynthesis.status,
          accessState,
          readingQuota: initialReadingQuota,
          instagramConnected: isInstagramConnected,
          brandMatches,
          brandMapConfirmed,
          mapConfirmations,
          needsOnboarding,
          streamBSignalsSummary,
          mapEvolutionStatus: resolveMapEvolutionStatus(
            selectorResult.profileSynthesis.status,
            mapConfirmations,
          ),
          contentIdeas,
          contentIdeasReadiness,
          audienceInsights: audienceInsights ?? null,
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
      }
    } catch (err) {
      console.error("Erro silencioso ao montar mapa narrativo mobile:", err);
    }
  }

  const stateQuery = typeof searchParams?.state === "string" ? searchParams.state : null;

  if (DIAGNOSTICO_V2_ENABLED && diagnosticoPageData) {
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-zinc-50" />}>
        <DiagnosticoRealShellClient
          data={diagnosticoPageData}
          onAnalyzeAction={null}
        />
      </Suspense>
    );
  }

  return (
    <MobileStrategicProfileRealShellClient
      session={session}
      stateQuery={stateQuery}
      initialSnapshotPayload={initialSnapshotPayload}
      initialNarrativeMapViewModel={initialNarrativeMapViewModel}
      initialNarrativeMapPresentation={initialNarrativeMapPresentation}
      initialReadingQuota={initialReadingQuota}
    />
  );
}
