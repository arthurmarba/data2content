import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isMobileStrategicProfileEnabled } from "../videoUpload/mobileStrategicProfileFeatureFlag";
import { MobileStrategicProfileRealShellClient } from "../components/videoUpload/appPreview/MobileStrategicProfileRealShellClient";
import { getStrategicProfileSnapshotByUserId } from "../videoUpload/mobileStrategicProfileSnapshotService";
import { buildNarrativeMapMobileViewModelFromReadings } from "../videoUpload/narrativeMapMobileViewModelServerSelector";
import { getNarrativeMapReadingQuotaForUser } from "../videoUpload/narrativeMapReadingQuotaService";
import type { NarrativeMapReadingQuotaSnapshot } from "../videoUpload/narrativeMapAccessState";

export const dynamic = "force-dynamic";

type MobileStrategicProfilePageProps = {
  searchParams?: {
    state?: string | string[];
  };
};

export default async function MobileStrategicProfilePage({
  searchParams,
}: MobileStrategicProfilePageProps) {
  // 1. Feature flag check
  if (!isMobileStrategicProfileEnabled()) {
    notFound();
    return null;
  }

  // 2. Server-side session check
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    const callbackUrl = encodeURIComponent("/dashboard/boards/mobile-strategic-profile");
    redirect(`/login?callbackUrl=${callbackUrl}&intent=strategic_profile`);
    return null;
  }

  // 3. Obter o snapshot estratégico ativo persistido
  let initialSnapshotPayload = null;
  let initialNarrativeMapViewModel = null;
  let initialNarrativeMapPresentation = null;
  let initialReadingQuota: NarrativeMapReadingQuotaSnapshot | null = null;
  const isSnapshotEnabled = process.env.MOBILE_STRATEGIC_PROFILE_SNAPSHOT_ENABLED !== "0";

  if (isSnapshotEnabled && session.user?.id) {
    try {
      const result = await getStrategicProfileSnapshotByUserId(session.user.id);
      if (result?.snapshot) {
        initialSnapshotPayload = result.snapshot;
      }
    } catch (err) {
      console.error("Erro silencioso ao ler snapshot estratégico no servidor:", err);
    }
  }

  if (session.user?.id) {
    try {
      initialReadingQuota = await getNarrativeMapReadingQuotaForUser({
        userId: session.user.id,
      });
      const result = await buildNarrativeMapMobileViewModelFromReadings({
        userId: session.user.id,
        displayName: session.user.name ?? "Creator",
        displayHandle: session.user.instagramUsername ? `@${session.user.instagramUsername}` : null,
        accessLevel: session.user.planStatus === "active" ? "premium" : "free",
        instagramConnected: Boolean(session.user.instagramConnected),
        mediaKitAvailable: Boolean(initialSnapshotPayload?.opportunities?.length),
      });
      initialNarrativeMapViewModel = result.viewModel;
      initialNarrativeMapPresentation = result.currentPresentation;
    } catch (err) {
      console.error("Erro silencioso ao montar mapa narrativo mobile:", err);
    }
  }

  // 4. Adapt session data and optional debug state to profile input
  const stateQuery = typeof searchParams?.state === "string" ? searchParams.state : null;

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
