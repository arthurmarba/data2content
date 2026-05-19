import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isMobileStrategicProfileEnabled } from "../videoUpload/mobileStrategicProfileFeatureFlag";
import { buildMobileStrategicProfileRealShellInput } from "../components/videoUpload/appPreview/buildMobileStrategicProfileRealShellInput";
import { buildMobileStrategicProfile } from "../videoUpload/mobileStrategicProfileMapping";
import { MobileStrategicProfilePreview } from "../components/videoUpload/appPreview/MobileStrategicProfilePreview";

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

  // 3. Adapt session data and optional debug state to profile input
  const stateQuery = typeof searchParams?.state === "string" ? searchParams.state : null;
  const shellInput = buildMobileStrategicProfileRealShellInput({
    session,
    stateQuery,
  });

  const profile = buildMobileStrategicProfile(shellInput);

  return (
    <MobileStrategicProfilePreview
      profile={profile}
      isRealShell={true}
    />
  );
}
