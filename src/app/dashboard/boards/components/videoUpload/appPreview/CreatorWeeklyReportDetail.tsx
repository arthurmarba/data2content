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
    <main className="mx-auto w-full max-w-[32rem] px-5 pb-8 pt-[var(--ds-safe-top)] ds-analysis-editorial">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-full bg-transparent pr-3 text-[13px] font-bold text-[var(--ds-color-brand-strong)]"
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

      <div className="mt-5 rounded-[18px] bg-[var(--ds-color-info-soft)] px-4 py-3 text-[13px] leading-[1.5] text-[var(--ds-color-info)]">
        <strong>Quanto dá para confiar.</strong> Indício é 1 ou 2 posts; sinal é de 3 a 7; tendência é 8 ou mais.
      </div>

      {detail.groups.length > 0 ? (
        <div className="mt-6 space-y-6">
          {detail.groups.map((group) => (
            <section key={group.id} aria-labelledby={`weekly-report-group-${group.id}`}>
              <div className="mb-3">
                <h2 id={`weekly-report-group-${group.id}`} className="text-[1.25rem] font-bold leading-tight text-[var(--ds-color-ink)]">
                  {group.title}
                </h2>
                <p className="ds-caption mt-1">{group.subtitle}</p>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]">
                {group.items.map((item, index) => {
                  const positive = item.index !== null && item.index >= 1;
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--ds-color-line)] px-3 py-3.5 last:border-b-0"
                    >
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-extrabold ${
                          index === 0
                            ? "bg-[var(--ds-color-ink)] text-white"
                            : "bg-[var(--ds-color-neutral)] text-[var(--ds-color-text-secondary)]"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-bold leading-[1.25] text-[var(--ds-color-ink)]">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-[11px] text-[var(--ds-color-text-muted)]">
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
        <section className="mt-6 rounded-[20px] bg-[var(--ds-color-neutral)] p-5">
          <span className="ds-eyebrow">Cobertura em formação</span>
          <h2 className="mt-2 text-[1.25rem] font-bold leading-tight text-[var(--ds-color-ink)]">
            Ainda não há dados suficientes para este ranking.
          </h2>
          <p className="ds-body mt-2">A seção aparece automaticamente quando os vídeos publicados recebem leitura suficiente.</p>
        </section>
      )}

      <section className="mt-6 border-l-2 border-[var(--ds-color-brand)] pl-4">
        <span className="ds-eyebrow">Leitura da semana</span>
        <p className="mt-2 text-[15px] leading-[1.55] text-[var(--ds-color-ink)]">
          {detail.interpretation ?? detail.summary}
        </p>
      </section>

      <p className="ds-caption mt-6 text-center">{detail.coverageLabel}</p>
    </main>
  );
}
