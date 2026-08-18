"use client";

import type { CreatorWeeklyReportRankGroup } from "@/app/lib/creatorWeeklyReport/types";

/**
 * "Indício / sinal / tendência" é o vocabulário interno do motor. Na tela ele vira
 * o que a pessoa deve fazer com aquela linha: testar de novo, confiar um pouco,
 * ou tratar como padrão.
 */
const EVIDENCE_LABEL = {
  indicio: "vale testar",
  sinal: "já se repetiu",
  tendencia: "padrão firme",
} as const;

export function formatRankIndex(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1).replace(".", ",")}×`;
}

/**
 * Os rankings de um padrão. Vive fora do card para poder ser lido tanto na
 * expansão do Perfil quanto em qualquer leitura longa — a régua de confiança
 * (indício / sinal / tendência) acompanha cada linha, porque um número sem o
 * tamanho da amostra atrás dele convida a decidir por coincidência.
 */
export function PatternRankGroups({
  groups,
  idPrefix,
}: {
  groups: CreatorWeeklyReportRankGroup[];
  idPrefix: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="ds-caption mt-3">
        Ainda não há posts suficientes para montar este ranking.
      </p>
    );
  }

  return (
    <div className="mt-1">
      {groups.map((group) => (
        <section key={group.id} className="mt-4 first:mt-0" aria-labelledby={`${idPrefix}-${group.id}`}>
          <h4
            id={`${idPrefix}-${group.id}`}
            className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--ds-color-text-muted)]"
          >
            {group.title}
          </h4>
          <div className="mt-1">
            {group.items.map((item, index) => {
              const positive = item.index !== null && item.index >= 1;
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--ds-color-line)] py-2.5 last:border-b-0"
                >
                  <span
                    className={`text-[12px] font-semibold tabular-nums ${index === 0 ? "text-[var(--ds-color-ink)]" : "text-[var(--ds-color-text-muted)]"}`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold leading-[1.3] text-[var(--ds-color-ink)]">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-[var(--ds-color-text-muted)]">
                      {item.nPosts} {item.nPosts === 1 ? "post" : "posts"} · {EVIDENCE_LABEL[item.evidence]}
                      {item.weeklyOccurrences > 0 ? ` · ${item.weeklyOccurrences} nesta semana` : ""}
                    </span>
                  </span>
                  <span
                    className={`text-[14px] font-extrabold tabular-nums ${
                      item.index === null
                        ? "text-[var(--ds-color-text-muted)]"
                        : positive
                          ? "text-[var(--ds-color-success)]"
                          : "text-[var(--ds-color-danger)]"
                    }`}
                  >
                    {formatRankIndex(item.index)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="ds-caption mt-3">Com 1 ou 2 posts, vale testar de novo. De 3 a 7, já se repetiu. Com 8 ou mais, é padrão firme.</p>
    </div>
  );
}
