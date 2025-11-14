"use client";

type DiscoverInsightsSectionProps = {
  viewsP50?: number | null;
  viewsP75?: number | null;
  interactionsP50?: number | null;
  interactionsP75?: number | null;
  totalPosts: number;
  topHourLabel?: string | null;
  heatmapBuckets?: Array<{ label: string; count: number }>;
  sampleWindowDays?: number;
  sectionsCount?: number;
};

function formatMetric(value?: number | null, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return "—";
  try {
    return `${value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}${suffix}`;
  } catch {
    return `${value}${suffix}`;
  }
}

type StatTileProps = {
  label: string;
  primary: string;
  secondary?: string;
  helper?: string;
};

function StatTile({ label, primary, secondary, helper }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">
        {primary}
        {secondary && <span className="text-base font-medium text-slate-500"> · {secondary}</span>}
      </p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

export default function DiscoverInsightsSection({
  viewsP50,
  viewsP75,
  interactionsP50,
  interactionsP75,
  totalPosts,
  topHourLabel,
  heatmapBuckets = [],
  sampleWindowDays,
  sectionsCount,
}: DiscoverInsightsSectionProps) {
  const totalHeat = heatmapBuckets.reduce((sum, bucket) => sum + bucket.count, 0) || 1;
  const windowLabel = sampleWindowDays ? `últimos ${sampleWindowDays} dias` : "janela recente";
  const sectionChipValue = typeof sectionsCount === "number" && sectionsCount > 0 ? String(sectionsCount) : null;
  const formattedViewsP50 = formatMetric(viewsP50);
  const formattedViewsP75 = formatMetric(viewsP75);
  const formattedInteractionsP50 = formatMetric(interactionsP50);
  const formattedInteractionsP75 = formatMetric(interactionsP75);
  const summaryChips = [
    { label: "Posts analisados", value: `${totalPosts}` },
    { label: "Janela", value: windowLabel },
    sectionChipValue ? { label: "Coleções", value: sectionChipValue } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const tips: string[] = [];
  if (topHourLabel) tips.push(`Poste perto de ${topHourLabel.toLowerCase()}. É quando o público está mais ligado.`);
  if (formattedViewsP50 !== "—") {
    const label = formattedViewsP75 !== "—" ? `${formattedViewsP50}–${formattedViewsP75}` : formattedViewsP50;
    tips.push(`Mire em ${label} views: abra com um gancho rápido e mostre o benefício logo.`);
  }
  if (formattedInteractionsP50 !== "—") {
    const label = formattedInteractionsP75 !== "—" ? `${formattedInteractionsP50}–${formattedInteractionsP75}` : formattedInteractionsP50;
    tips.push(`Peça ações diretas (salvar, comentar) para chegar em ${label} interações.`);
  }
  const hasTips = tips.length > 0;
  const topBuckets = heatmapBuckets.slice(0, 4);
  const hasHeatmap = topBuckets.length > 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
      <header className="space-y-4 border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Panorama de desempenho</p>
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Sinais que a IA captou esta semana
            </h2>
          </div>
          <div className="text-right text-xs font-medium uppercase tracking-wide text-slate-400 sm:text-sm">
            Atualizado automaticamente
          </div>
        </div>
        {summaryChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {summaryChips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {chip.label}: <span className="text-slate-900">{chip.value}</span>
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="grid gap-4 pt-5 sm:grid-cols-2">
        <StatTile
          label="Views típicas"
          primary={formattedViewsP50}
          secondary={formattedViewsP75 !== "—" ? formattedViewsP75 : undefined}
          helper="P50 é o valor mediano; P75 é quando começa a viralizar."
        />
        <StatTile
          label="Interações típicas"
          primary={formattedInteractionsP50}
          secondary={formattedInteractionsP75 !== "—" ? formattedInteractionsP75 : undefined}
          helper="Curtidas, comentários, envios e salvamentos combinados."
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Horário mais quente</p>
            <p className="text-xl font-semibold text-slate-900">{topHourLabel || "—"}</p>
          </div>
          <p className="text-xs text-slate-500">Base: melhores slots da amostra.</p>
        </div>
        {hasHeatmap ? (
          <div className="mt-4 space-y-3">
            {topBuckets.map((bucket) => {
              const ratio = bucket.count / totalHeat;
              const widthPercent = `${Math.max(ratio * 100, 8)}%`;
              return (
                <div key={bucket.label} className="flex items-center gap-3">
                  <span className="w-32 text-sm font-medium text-slate-600">{bucket.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-brand-magenta to-brand-purple"
                      style={{ width: widthPercent }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{Math.round(ratio * 100)}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
            Sem dados suficientes ainda. Assim que os primeiros slots aparecerem, mostramos aqui.
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-5 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Movimentos sugeridos</p>
        {hasTips ? (
          <div className="mt-3 space-y-3 text-sm">
            {tips.map((tip) => (
              <div key={tip} className="flex items-start gap-3">
                <span className="text-base text-white/60">✓</span>
                <p className="text-white/90">{tip}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/70">Ainda não temos recomendações suficientes para o segmento.</p>
        )}
      </div>
    </section>
  );
}
