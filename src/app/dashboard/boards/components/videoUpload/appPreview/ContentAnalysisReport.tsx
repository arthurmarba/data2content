"use client";

import Image from "next/image";
import type { MobileStrategicProfileAnalyzeConfirmationData } from "./MobileStrategicProfileAnalyzeFlow";
import type {
  VideoNarrativeContentPotentialScan,
  VideoNarrativeEngagementPotentialVerdict,
  VideoNarrativePersonalComparison,
  VideoNarrativePotentialDimensionStatus,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeContentPotentialScan";

const VERDICT_COPY: Record<VideoNarrativeEngagementPotentialVerdict, string> = {
  strong: "Tem forte potencial de engajar.",
  promising: "Tem potencial de engajar.",
  promising_with_adjustment: "Pode engajar após um ajuste.",
  uncertain: "O potencial de engajamento ainda é incerto.",
  limited: "Tem poucos sinais de engajamento no formato atual.",
};

const STATUS_LABEL: Record<VideoNarrativePotentialDimensionStatus, string> = {
  strong: "Forte",
  mixed: "Parcial",
  weak: "Atenção",
  unknown: "Sem base",
};

const STATUS_DOT: Record<VideoNarrativePotentialDimensionStatus, string> = {
  strong: "bg-zinc-950",
  mixed: "bg-zinc-500",
  weak: "bg-zinc-800",
  unknown: "bg-zinc-300",
};

const IMPACT_LABEL: Record<VideoNarrativePersonalComparison["impact"], string> = {
  positive: "Alinhado",
  limiting: "Pode limitar",
  experimental: "Experimento",
  neutral: "Neutro",
  unknown: "Sem base",
};

const MOMENT_LABEL = {
  opening: "Abertura",
  development: "Desenvolvimento",
  closing: "Fechamento",
} as const;

function fallbackVerdict(scan: VideoNarrativeContentPotentialScan): VideoNarrativeEngagementPotentialVerdict {
  if (scan.band === "strong") return "strong";
  if (scan.band === "promising_with_adjustment") return "promising_with_adjustment";
  if (scan.band === "weak_signals") return "limited";
  return "uncertain";
}

function basisText(scan: VideoNarrativeContentPotentialScan): string {
  const potential = scan.engagementPotential;
  const count = potential?.postsCompared ?? scan.historyPostsAnalyzed;
  if (count <= 0) return "Leitura baseada principalmente na estrutura deste vídeo.";
  return `Comparação com ${count} ${count === 1 ? "conteúdo publicado" : "conteúdos publicados"}.`;
}

function Signal({
  label,
  status,
  evidence,
}: {
  label: string;
  status: VideoNarrativePotentialDimensionStatus;
  evidence: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-950">
          {label} <span className="font-medium text-zinc-400">· {STATUS_LABEL[status]}</span>
        </p>
        <p className="mt-1 text-sm leading-5 text-zinc-600">{evidence}</p>
      </div>
    </div>
  );
}

function Comparison({ item }: { item: VideoNarrativePersonalComparison }) {
  return (
    <article className="rounded-2xl bg-zinc-50 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-zinc-950">{item.label}</h3>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
          {IMPACT_LABEL[item.impact]}
        </span>
      </div>
      <dl className="mt-3 space-y-3">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">Neste vídeo</dt>
          <dd className="mt-1 text-sm leading-5 text-zinc-800">{item.current}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">No seu histórico</dt>
          <dd className="mt-1 text-sm leading-5 text-zinc-800">{item.historical}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{item.reading}</p>
    </article>
  );
}

export function ContentAnalysisReport({
  data,
  thumbnailSrc,
  analyzedAt,
  onCopySuggestion,
}: {
  data: MobileStrategicProfileAnalyzeConfirmationData | null;
  thumbnailSrc?: string | null;
  analyzedAt?: string | null;
  onCopySuggestion?: (scan: VideoNarrativeContentPotentialScan) => void;
}) {
  const scan = data?.contentPotentialScan ?? null;

  if (!scan) {
    return (
      <div className="py-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">Análise concluída</p>
        <h2 className="mt-2 font-display text-[1.8rem] font-bold leading-[1] tracking-[-0.045em] text-zinc-950">
          Sua leitura foi salva.
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {data?.diagnosisSummary ?? "Os sinais identificados já estão disponíveis nas suas últimas análises."}
        </p>
      </div>
    );
  }

  const potential = scan.engagementPotential;
  const verdict = potential?.verdict ?? fallbackVerdict(scan);
  const confidence = potential?.confidence ?? scan.confidence;
  const comparisons = scan.personalComparisons ?? [];
  const signalDimensions = [
    ["Gancho e abertura", scan.dimensions.openingClarity],
    ["Cenas e progressão", scan.dimensions.attentionArchitecture],
    ["Vontade de compartilhar", scan.dimensions.shareImpulse],
    ["Entrega da promessa", scan.dimensions.promiseDelivery],
    ["Assunto e narrativa", scan.dimensions.narrativeFit],
  ] as const;

  return (
    <article className="ds-analysis-editorial pb-2">
      {thumbnailSrc ? (
        <figure className="relative -mx-5 -mt-1 mb-6 aspect-[16/10] overflow-hidden bg-zinc-100">
          <Image
            src={thumbnailSrc}
            alt="Capa do conteúdo analisado"
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover"
          />
          <figcaption className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            Conteúdo analisado
          </figcaption>
        </figure>
      ) : null}

      <header className="ds-enter-sheet">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">
            Potencial de engajamento
          </p>
          {analyzedAt ? <time className="text-[11px] text-zinc-400">{analyzedAt}</time> : null}
        </div>
        <h2 className="mt-2 max-w-[12ch] font-display text-[2.05rem] font-bold leading-[0.98] tracking-[-0.055em] text-zinc-950">
          {VERDICT_COPY[verdict]}
        </h2>
        <p className="mt-3 text-[0.95rem] leading-6 text-zinc-600">
          {potential?.summary ?? data?.directAnswer ?? "A estrutura do vídeo foi comparada com os sinais disponíveis no seu perfil."}
        </p>
        <p className="mt-3 text-[11px] font-semibold text-zinc-500">
          Confiança {confidence === "high" ? "alta" : confidence === "medium" ? "média" : "baixa"} · {basisText(scan)}
        </p>
      </header>

      <section className="mt-7" aria-labelledby="analysis-summary-title">
        <h3 id="analysis-summary-title" className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">
          Em resumo
        </h3>
        <div className="mt-2 space-y-1">
          {signalDimensions.map(([label, dimension]) => (
            <Signal key={label} label={label} status={dimension.status} evidence={dimension.evidence} />
          ))}
        </div>
      </section>

      {comparisons.length > 0 ? (
        <section className="mt-7" aria-labelledby="history-comparison-title">
          <h3 id="history-comparison-title" className="font-display text-[1.3rem] font-bold tracking-[-0.035em] text-zinc-950">
            Este vídeo × seu histórico
          </h3>
          <p className="mt-1 text-sm leading-5 text-zinc-500">
            O que aparece agora e o que tende a acompanhar seus conteúdos de maior interação.
          </p>
          <div className="mt-4 space-y-3">
            {comparisons.map((item) => <Comparison key={item.dimension} item={item} />)}
          </div>
        </section>
      ) : null}

      {scan.watchedMoments?.length ? (
        <section className="mt-8" aria-labelledby="moments-title">
          <h3 id="moments-title" className="font-display text-[1.3rem] font-bold tracking-[-0.035em] text-zinc-950">
            Como o vídeo se desenvolve
          </h3>
          <div className="mt-4">
            {scan.watchedMoments.map((moment, index) => (
              <div key={`${moment.moment}-${index}`} className="grid grid-cols-[12px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-zinc-950" />
                  {index < scan.watchedMoments!.length - 1 ? <span className="my-1 w-px flex-1 bg-zinc-200" /> : null}
                </div>
                <div className="pb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-zinc-400">{MOMENT_LABEL[moment.moment]}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-zinc-900">{moment.observation}</p>
                  <p className="mt-1 text-sm leading-5 text-zinc-500">{moment.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-3" aria-labelledby="full-analysis-title">
        <h3 id="full-analysis-title" className="font-display text-[1.3rem] font-bold tracking-[-0.035em] text-zinc-950">
          Análise completa
        </h3>
        <div className="mt-3 space-y-2">
          {signalDimensions.map(([label, dimension]) => (
            <details key={label} className="group rounded-xl bg-zinc-50 px-4 py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-zinc-900">
                <span>{label}</span>
                <span className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  {STATUS_LABEL[dimension.status]}
                  <span className="transition-transform group-open:rotate-90">›</span>
                </span>
              </summary>
              <div className="pb-4">
                <p className="text-sm leading-5 text-zinc-600">{dimension.evidence}</p>
                {dimension.adjustment ? (
                  <p className="mt-2 text-xs font-semibold leading-5 text-zinc-800">Direção: {dimension.adjustment}</p>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-7 rounded-[1.4rem] bg-zinc-950 p-5 text-white" aria-labelledby="impact-adjustment-title">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/50">Ajuste de maior impacto</p>
        <h3 id="impact-adjustment-title" className="mt-2 font-display text-[1.35rem] font-bold leading-[1.05] tracking-[-0.035em]">
          {scan.practicalDirection?.title ?? scan.highestImpactAdjustment}
        </h3>
        {scan.practicalDirection?.action ? <p className="mt-2 text-sm leading-5 text-white/70">{scan.practicalDirection.action}</p> : null}
        {scan.practicalDirection?.example ? (
          <blockquote className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold leading-5">
            “{scan.practicalDirection.example}”
          </blockquote>
        ) : null}
        {onCopySuggestion ? (
          <button type="button" onClick={() => onCopySuggestion(scan)} className="mt-4 min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-zinc-950">
            Copiar sugestão
          </button>
        ) : null}
      </section>

      <details className="mt-5 rounded-xl bg-zinc-50 px-4 py-1 text-xs text-zinc-500">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold text-zinc-700">
          Sobre esta leitura <span aria-hidden="true">›</span>
        </summary>
        <p className="pb-4 leading-5">
          {scan.disclaimer} A análise indica uma tendência relativa ao seu histórico e não garante resultado.
        </p>
      </details>
    </article>
  );
}
