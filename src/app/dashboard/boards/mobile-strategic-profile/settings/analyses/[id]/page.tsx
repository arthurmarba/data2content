import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ContentAnalysisReport } from "@/app/dashboard/boards/components/videoUpload/appPreview/ContentAnalysisReport";
import { ProfileSettingsPage } from "@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage";
import { buildAnalysisConfirmationDataFromReading } from "@/app/dashboard/boards/components/videoUpload/appPreview/mobileStrategicProfileAnalysisConfirmationClient";
import { getCreatorVideoNarrativeDiagnosisForUser } from "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisReadService";

export const dynamic = "force-dynamic";

const HISTORY_HREF = "/dashboard/boards/mobile-strategic-profile/settings/analyses";

type Props = { params: Promise<{ id: string }> };

function formatDate(value: Date | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(value)
    .replace(" de ", " ");
}

export default async function ContentAnalysisDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { id } = await params;
  if (!userId) {
    const callbackUrl = encodeURIComponent(`${HISTORY_HREF}/${id}`);
    redirect(`/login?callbackUrl=${callbackUrl}&intent=strategic_profile`);
  }
  const reading = await getCreatorVideoNarrativeDiagnosisForUser({ userId, diagnosisId: id });
  if (!reading || reading.historyVisibility === "hidden" || !reading.contentPotentialScan) notFound();

  const data = buildAnalysisConfirmationDataFromReading(reading);
  return (
    <ProfileSettingsPage title="Análise de conteúdo" backHref={HISTORY_HREF}>
      <section className="ds-notebook-section ds-notebook-section--first overflow-hidden">
        <ContentAnalysisReport
          data={data}
          thumbnailSrc={reading.thumbnailStatus === "available"
            ? `/api/dashboard/mobile-strategic-profile/analyses/${encodeURIComponent(reading.diagnosisId)}/thumbnail`
            : null}
          analyzedAt={formatDate(reading.analyzedAt ?? reading.createdAt)}
        />
      </section>
    </ProfileSettingsPage>
  );
}
