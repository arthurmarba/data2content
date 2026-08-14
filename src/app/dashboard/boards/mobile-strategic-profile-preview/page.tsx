import { MobileStrategicProfilePreview } from "../components/videoUpload/appPreview/MobileStrategicProfilePreview";
import { buildMobileStrategicProfilePreviewFixture } from "../components/videoUpload/appPreview/buildMobileStrategicProfilePreviewFixture";
import { NarrativeMapReadingPreview } from "../components/videoUpload/appPreview/NarrativeMapReadingPreview";
import { buildContentAnalysisPreviewResult } from "../components/videoUpload/appPreview/buildContentAnalysisPreviewResult";
import {
  buildNarrativeMapReadingPreviewFixture,
  isNarrativeMapReadingPreviewState,
} from "../components/videoUpload/appPreview/buildNarrativeMapReadingPreviewFixture";
import {
  canAccessInternalPreview,
  getCurrentInternalPreviewUser,
  type InternalPreviewUser,
} from "../internalPreviewAccess";
import { isMobileStrategicProfilePreviewEnabled } from "../videoUpload/mobileStrategicProfilePreviewFeatureFlag";
import { MobileOnboardingPreviewHarness } from "../components/videoUpload/appPreview/MobileOnboardingPreviewHarness";

type MobileStrategicProfilePreviewPageProps = {
  searchParams?: {
    state?: string | string[];
  } | Promise<{
    state?: string | string[];
  }>;
  viewer?: InternalPreviewUser | null;
};

function BlockedInternalPreview({ reason }: { reason: "flag" | "permission" }) {
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno bloqueado</p>
        <h1 className="mt-2 text-2xl font-semibold">Perfil Estratégico mobile</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          {reason === "flag"
            ? "Preview bloqueado por flag. Ative NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED=1 para visualizar esta rota."
            : "Preview interno restrito a usuários admin/dev."}
        </p>
      </section>
    </main>
  );
}

export default async function MobileStrategicProfilePreviewPage({
  searchParams,
  viewer,
}: MobileStrategicProfilePreviewPageProps = {}) {
  if (!isMobileStrategicProfilePreviewEnabled()) {
    return <BlockedInternalPreview reason="flag" />;
  }

  const currentUser = viewer === undefined ? await getCurrentInternalPreviewUser() : viewer;
  if (!canAccessInternalPreview(currentUser)) {
    return <BlockedInternalPreview reason="permission" />;
  }

  const resolvedSearchParams = await searchParams;

  if (resolvedSearchParams?.state === "north_onboarding") {
    return <MobileOnboardingPreviewHarness />;
  }

  if (isNarrativeMapReadingPreviewState(resolvedSearchParams?.state)) {
    const fixture = buildNarrativeMapReadingPreviewFixture({ state: resolvedSearchParams?.state });
    return <NarrativeMapReadingPreview fixture={fixture} />;
  }

  const fixture = buildMobileStrategicProfilePreviewFixture({ state: resolvedSearchParams?.state });
  return (
    <MobileStrategicProfilePreview
      profile={fixture.profile}
      activeState={fixture.id}
      showSmokeHarness
      analysisPreviewResult={buildContentAnalysisPreviewResult()}
      analysisPreviewDelayMs={6500}
      analysisPreviewThumbnailSrc="/images/mulher_se_maquiando.png"
    />
  );
}
