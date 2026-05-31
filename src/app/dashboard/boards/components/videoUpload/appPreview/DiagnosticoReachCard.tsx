import type { InstagramMetricsSummary } from "@/app/dashboard/boards/videoUpload/instagramMetricsSummaryService";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { HC, CARD_P, CARD_METRIC, CARD_BODY } from "./diagnosticoTokens";

function formatReach(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

function formatEngagement(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/** Sparkline of weekly reach (real data from reachOverTime). */
function ReachSparkline({ series }: { series: number[] }) {
  const hasData = series.length > 0 && series.some((v) => v > 0);
  if (!hasData) {
    // Decorative fallback when no historical data
    const heights = [55, 70, 45, 90, 30];
    return (
      <div className="flex items-end gap-[3px]" aria-hidden="true">
        {heights.map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-sm bg-sky-200"
            style={{ height: `${h * 0.22}px` }}
          />
        ))}
      </div>
    );
  }
  const max = Math.max(...series, 1);
  return (
    <div className="flex items-end gap-[3px] h-[22px]" aria-hidden="true" title="Alcance médio semanal (últimas semanas)">
      {series.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-sky-500"
          style={{
            height: `${Math.max(15, (v / max) * 100)}%`,
            opacity: v === 0 ? 0.2 : 1,
          }}
        />
      ))}
    </div>
  );
}

export function DiagnosticoReachCard({
  metrics,
  narrativeLabel,
}: {
  metrics: InstagramMetricsSummary;
  narrativeLabel?: string | null;
}) {
  const reach = formatReach(metrics.avgReachPerPost);
  const eng = formatEngagement(metrics.avgEngagementRate);
  const views = formatReach(metrics.avgReelsViews);

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.reach.bg}
          iconSlot={<ReachIcon />}
          category="SINAIS DO INSTAGRAM"
          catColor={HC.reach.text}
          timestamp="semana atual"
        />
        <div className="flex items-end justify-between gap-3">
          <p className={CARD_METRIC}>
            {reach}
            <span className="ml-1 text-[14px] font-medium text-zinc-400">por post</span>
          </p>
          <ReachSparkline series={metrics.reachOverTime ?? []} />
        </div>
        <p className="mt-2 text-[13px] font-semibold text-zinc-500">
          {eng} engajamento
          {metrics.avgReelsViews != null && ` · ${views} views/Reels`}
        </p>
        {narrativeLabel && metrics.avgReachPerPost != null && (
          <p className={`mt-2 ${CARD_BODY}`}>
            <span className="font-semibold text-zinc-800">{narrativeLabel}</span> aparece nos posts com mais resposta do seu perfil
          </p>
        )}
        {metrics.topFormats.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {metrics.topFormats.map((f) => (
              <span key={f} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

function ReachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
