import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ArrowUpRight, ScanSearch } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { listCreatorVideoNarrativeDiagnosesForUser } from "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisReadService";
import type { VideoNarrativeEngagementPotentialVerdict } from "@/app/dashboard/boards/videoUpload/videoNarrativeContentPotentialScan";
import { AnalysisSettingsHeader } from "./AnalysisSettingsHeader";

export const dynamic = "force-dynamic";

const PROFILE_HREF = "/dashboard/boards/mobile-strategic-profile";

const VERDICT: Record<VideoNarrativeEngagementPotentialVerdict, string> = {
  strong: "Forte potencial de engajamento",
  promising: "Potencial de engajamento",
  promising_with_adjustment: "Pode engajar após um ajuste",
  uncertain: "Potencial ainda incerto",
  limited: "Poucos sinais de engajamento",
};

function formatDate(value: Date | undefined): string {
  if (!value) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(value)
    .replace(" de ", " ");
}

export default async function ContentAnalysisHistoryPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const callbackUrl = encodeURIComponent(`${PROFILE_HREF}/settings/analyses`);
    redirect(`/login?callbackUrl=${callbackUrl}&intent=strategic_profile`);
  }

  const readings = await listCreatorVideoNarrativeDiagnosesForUser({ userId, limit: 40 });
  const analyses = readings.filter((reading) => reading.analysisVersion === "v2" || Boolean(reading.contentPotentialScan));

  return (
    <main className="min-h-dvh bg-white text-zinc-950">
      <AnalysisSettingsHeader title="Últimas análises" backHref={PROFILE_HREF} />
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">Seu arquivo</p>
        <h2 className="mt-2 max-w-[15ch] font-display text-[2rem] font-bold leading-[0.98] tracking-[-0.055em]">
          Conteúdos que você já analisou.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
          Guardamos o relatório e uma capa leve. O vídeo enviado é apagado após a análise.
        </p>

        {analyses.length === 0 ? (
          <section className="mt-12 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-600">
              <ScanSearch className="h-5 w-5" strokeWidth={1.7} />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold tracking-[-0.03em]">Nenhuma análise por aqui</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">
              Use o botão + no Perfil para analisar seu primeiro conteúdo.
            </p>
            <Link href={PROFILE_HREF} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white">
              Voltar ao Perfil
            </Link>
          </section>
        ) : (
          <div className="mt-9 space-y-3">
            {analyses.map((reading) => {
              const scan = reading.contentPotentialScan;
              const fallbackVerdict: VideoNarrativeEngagementPotentialVerdict = scan?.band === "strong"
                ? "strong"
                : scan?.band === "promising_with_adjustment"
                  ? "promising_with_adjustment"
                  : scan?.band === "weak_signals"
                    ? "limited"
                    : "uncertain";
              const verdict = scan?.engagementPotential?.verdict ?? fallbackVerdict;
              const detailHref = `${PROFILE_HREF}/settings/analyses/${encodeURIComponent(reading.diagnosisId)}`;
              return (
                <Link
                  key={reading.diagnosisId}
                  href={detailHref}
                  className="group grid min-h-[104px] grid-cols-[78px_1fr_auto] items-center gap-4 rounded-2xl bg-zinc-50 p-3 transition active:scale-[0.995] hover:bg-zinc-100"
                >
                  <div className="relative h-20 w-[78px] overflow-hidden rounded-xl bg-zinc-200">
                    {reading.thumbnailStatus === "available" ? (
                      <Image
                        src={`/api/dashboard/mobile-strategic-profile/analyses/${encodeURIComponent(reading.diagnosisId)}/thumbnail`}
                        alt=""
                        fill
                        unoptimized
                        sizes="78px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-zinc-400"><ScanSearch className="h-5 w-5" /></span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-zinc-400">{formatDate(reading.analyzedAt ?? reading.createdAt)}</p>
                    <h3 className="mt-1 text-sm font-bold leading-5 text-zinc-950">{VERDICT[verdict]}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-zinc-500">
                      {scan?.engagementPotential?.summary ?? reading.videoReading.rememberedAs}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-zinc-300 transition group-hover:text-zinc-600" strokeWidth={1.8} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
