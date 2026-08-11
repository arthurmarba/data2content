import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ContentAnalysisReport } from "@/app/dashboard/boards/components/videoUpload/appPreview/ContentAnalysisReport";
import { buildAnalysisConfirmationDataFromReading } from "@/app/dashboard/boards/components/videoUpload/appPreview/mobileStrategicProfileAnalysisConfirmationClient";
import { getCreatorVideoNarrativeDiagnosisForUser } from "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisReadService";
import { AnalysisSettingsHeader } from "../AnalysisSettingsHeader";

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
    <main className="min-h-dvh bg-white text-zinc-950">
      <AnalysisSettingsHeader title="Análise de conteúdo" backHref={HISTORY_HREF} />
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-5">
        <ContentAnalysisReport
          data={data}
          thumbnailSrc={reading.thumbnailStatus === "available"
            ? `/api/dashboard/mobile-strategic-profile/analyses/${encodeURIComponent(reading.diagnosisId)}/thumbnail`
            : null}
          analyzedAt={formatDate(reading.analyzedAt ?? reading.createdAt)}
        />
      </div>
    </main>
  );
}
