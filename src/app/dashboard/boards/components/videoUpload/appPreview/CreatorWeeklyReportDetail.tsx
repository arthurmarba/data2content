"use client";

import type { CreatorWeeklyReportDetail as ReportDetail } from "@/app/lib/creatorWeeklyReport/types";

const EVIDENCE_LABEL = {
  indicio: "indício",
  sinal: "sinal",
  tendencia: "tendência",
} as const;

function formatIndex(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1).replace(".", ",")}×`;
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CreatorWeeklyReportDetail({
  detail,
  isDemo,
  onBack,
}: {
  detail: ReportDetail;
  isDemo: boolean;
  onBack: () => void;
}) {
  return (
    <main className="ds-notebook-page ds-analysis-editorial">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-md bg-transparent pr-3 text-[13px] font-semibold text-[var(--ds-color-ink)] active:bg-[var(--ds-color-neutral)]"
      >
        <BackIcon /> Voltar
      </button>

      <header>
        <div className="flex items-center gap-2">
          <span className="ds-eyebrow">Seu relatório</span>
          {isDemo ? <span className="ds-badge ds-badge--neutral">Exemplo</span> : null}
        </div>
        <h1 className="mt-2 text-[2rem] font-bold leading-[1.02] text-[var(--ds-color-ink)]">
          {detail.title}
        </h1>
        <p className="ds-body mt-2">{detail.subtitle}</p>
      </header>

      <details className="group mt-5 rounded-xl bg-white px-4 py-2 text-[13px]">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold text-[var(--ds-color-ink)]">
          Quanto dá para confiar
          <span className="text-[var(--ds-color-text-muted)] transition-transform group-open:rotate-90" aria-hidden="true">›</span>
        </summary>
        <p className="pb-2 pr-6 leading-[1.5] text-[var(--ds-color-text-muted)]">Indício é 1 ou 2 posts; sinal é de 3 a 7; tendência é 8 ou mais.</p>
      </details>

      {detail.groups.length > 0 ? (
        <div className="mt-6">
          {detail.groups.map((group) => (
            <section key={group.id} className="ds-notebook-section" aria-labelledby={`weekly-report-group-${group.id}`}>
              <div className="mb-3">
                <h2 id={`weekly-report-group-${group.id}`} className="text-[1.25rem] font-bold leading-tight text-[var(--ds-color-ink)]">
                  {group.title}
                </h2>
                <p className="ds-caption mt-1">{group.subtitle}</p>
              </div>

              <div className="space-y-1">
                {group.items.map((item, index) => {
                  const positive = item.index !== null && item.index >= 1;
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg py-3"
                    >
                      <span
                        className={`text-[12px] font-semibold ${index === 0 ? "text-[var(--ds-color-ink)]" : "text-[var(--ds-color-text-muted)]"}`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-bold leading-[1.25] text-[var(--ds-color-ink)]">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-[12px] text-[var(--ds-color-text-muted)]">
                          {item.nPosts} {item.nPosts === 1 ? "post" : "posts"} · {EVIDENCE_LABEL[item.evidence]}
                          {item.weeklyOccurrences > 0 ? ` · ${item.weeklyOccurrences} nesta semana` : ""}
                        </span>
                      </span>
                      <span
                        className={`text-[15px] font-extrabold tabular-nums ${
                          item.index === null
                            ? "text-[var(--ds-color-text-muted)]"
                            : positive
                              ? "text-[var(--ds-color-success)]"
                              : "text-[var(--ds-color-danger)]"
                        }`}
                      >
                        {formatIndex(item.index)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="ds-notebook-section mt-6">
          <span className="ds-eyebrow">Cobertura em formação</span>
          <h2 className="mt-2 text-[1.25rem] font-bold leading-tight text-[var(--ds-color-ink)]">
            Ainda não há dados suficientes para este ranking.
          </h2>
          <p className="ds-body mt-2">A seção aparece automaticamente quando os vídeos publicados recebem leitura suficiente.</p>
        </section>
      )}

      <section className="ds-notebook-section mt-6">
        <span className="ds-eyebrow">Leitura da semana</span>
        <p className="mt-2 text-[15px] leading-[1.55] text-[var(--ds-color-ink)]">
          {detail.interpretation ?? detail.summary}
        </p>
      </section>

      <p className="ds-caption mt-6 text-center">{detail.coverageLabel}</p>
    </main>
  );
}
