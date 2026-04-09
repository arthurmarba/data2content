"use client";

import React from "react";
import { ArrowUpRight, Clock3, Copy, ExternalLink, Gift, LineChart as LineChartIcon, Sparkles, Target, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer as RechartsResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { track } from "@/lib/track";
import { MobileBarList, STRATEGIC_CATEGORY_CARDS } from "./PlanningChartsSharedUi";

const ResponsiveContainer = RechartsResponsiveContainer;
const cardBase = "dashboard-panel min-w-0 overflow-hidden rounded-[1.75rem] px-3.5 py-3.5 sm:px-4 sm:py-4";
const formatCardBase = "min-w-0 overflow-hidden rounded-[1.75rem] border border-zinc-100/90 bg-zinc-50/68 px-3.5 py-3.5 sm:px-4 sm:py-4";
const audienceCardBase = "min-w-0 overflow-hidden rounded-[1.75rem] border border-zinc-100/90 bg-zinc-50/68 px-3.5 py-3.5 sm:px-4 sm:py-4";
const tooltipStyle = { borderRadius: 18, border: "1px solid rgba(228,228,231,0.88)", boxShadow: "0 18px 44px rgba(15,23,42,0.12)", backdropFilter: "blur(14px)" };
const numberFormatter = new Intl.NumberFormat("pt-BR");
const compactNumberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const WEEKDAY_SHORT_SUN_FIRST = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const WEEKDAY_LONG_SUN_FIRST = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

const formatPostsCount = (count: number) => {
  const rounded = Math.max(0, Math.round(count));
  return `${numberFormatter.format(rounded)} post${rounded === 1 ? "" : "s"}`;
};

const formatPercentLabel = (value: number | null | undefined, digits = 0) => {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${safeValue.toFixed(digits)}%`;
};

const formatCompactFollowers = (value: number | null | undefined) => {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (safeValue === null || safeValue <= 0) return "base não informada";
  return `${compactNumberFormatter.format(safeValue)} seguidores`;
};

function CategoryPerformanceCard({
  config,
  rows,
  isLoading,
  isMobileViewport,
  primaryMetricShortLabel,
  primaryMetricUnitLabel,
  onCategoryClick,
  chartHeaderTextClassName,
  chartHeightClassName,
}: {
  config: any;
  rows: any[];
  isLoading: boolean;
  isMobileViewport: boolean;
  primaryMetricShortLabel: string;
  primaryMetricUnitLabel: string;
  onCategoryClick: (field: string, value: string, subtitle: string) => void;
  chartHeaderTextClassName: string;
  chartHeightClassName: string;
}) {
  const visibleRows = Array.isArray(rows) ? rows.slice(0, 5) : [];

  return (
    <article className={cardBase}>
      <header className="flex items-center justify-between gap-3">
        <div className={chartHeaderTextClassName}>
          <h2 className="text-base font-semibold text-slate-900">{config.title}</h2>
        </div>
        <Sparkles className="h-5 w-5 text-slate-500" />
      </header>
      <div className={isMobileViewport ? "mt-3" : chartHeightClassName}>
        {isLoading ? (
          <p className="text-sm text-slate-500">{config.loadingText}</p>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-slate-500">{config.emptyText}</p>
        ) : isMobileViewport ? (
          <MobileBarList
            items={visibleRows.map((item) => ({
              id: item.name,
              label: item.name,
              value: item.value,
              postsCount: item.postsCount,
            }))}
            emptyText={config.emptyText}
            accentClassName={config.accentClassName}
            valueFormatter={(value: number) => numberFormatter.format(Math.round(value))}
            onSelect={(item: any) =>
              onCategoryClick(config.field, item.label, `${primaryMetricShortLabel} por ${config.subtitle.toLowerCase()}`)
            }
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={visibleRows}
              layout="vertical"
              margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
              style={{ cursor: "pointer" }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#475569", fontSize: 12 }}
                width={150}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="value"
                name={primaryMetricUnitLabel}
                fill={config.color}
                radius={[0, 6, 6, 0]}
                onClick={(state: any) => {
                  const value = state?.payload?.name ? String(state.payload.name) : null;
                  if (value) {
                    onCategoryClick(config.field, value, `${primaryMetricShortLabel} por ${config.subtitle.toLowerCase()}`);
                  }
                }}
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value: number) => numberFormatter.format(Math.round(value))}
                  fill="#64748b"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );
}

export function PlanningContentDesktopSection(props: any) {
  return (
    <div className="space-y-3.5">
      <section className="space-y-2.5">
        <div className="space-y-2.5">
          <div className="grid gap-4 grid-cols-1">
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div className={props.chartHeaderTextClassName}>
                  <h2 className="text-base font-semibold text-slate-900">Proposta</h2>
                  <p className="text-xs text-slate-500">Apoio</p>
                </div>
                <Sparkles className="h-5 w-5 text-indigo-500" />
              </header>
              <div className={props.useCompactContentCharts ? "mt-3" : props.chartHeightClassName}>
                {props.loadingProposal ? (
                  <p className="text-sm text-slate-500">Carregando propostas...</p>
                ) : props.displayProposalBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem propostas registradas no período.</p>
                ) : props.useCompactContentCharts ? (
                  <MobileBarList
                    items={props.displayProposalBars.map((item: any) => ({
                      id: item.name,
                      label: item.name,
                      value: item.value,
                      postsCount: item.postsCount,
                    }))}
                    emptyText="Sem propostas registradas no período."
                    accentClassName="bg-indigo-500"
                    valueFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    dense={props.isCompactBoard}
                    onSelect={(item: any) => props.handleCategoryClick("proposal", item.label, `${props.primaryMetricShortLabel} por proposta`)}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={props.displayProposalBars}
                      layout="vertical"
                      margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name={props.primaryMetricUnitLabel} fill="#6366f1" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) props.handleCategoryClick("proposal", val, `${props.primaryMetricShortLabel} por proposta`); }}>
                        <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={audienceCardBase}>
              <header className="flex items-center justify-between gap-3">
                <div className={props.chartHeaderTextClassName}>
                  <h2 className="text-base font-semibold text-slate-900">Tema</h2>
                  <p className="text-xs text-slate-500">Apoio</p>
                </div>
                <Target className="h-5 w-5 text-slate-600" />
              </header>
              <div className={props.useCompactContentCharts ? "mt-3" : props.chartHeightClassName}>
                {props.loadingPosts ? (
                  <p className="text-sm text-slate-500">Carregando temas...</p>
                ) : props.displayContextBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem temas registrados no período.</p>
                ) : props.useCompactContentCharts ? (
                  <MobileBarList
                    items={props.displayContextBars.map((item: any) => ({
                      id: item.name,
                      label: item.name,
                      value: item.value,
                      postsCount: item.postsCount,
                    }))}
                    emptyText="Sem temas registrados no período."
                    accentClassName="bg-sky-500"
                    valueFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    dense={props.isCompactBoard}
                    onSelect={(item: any) => props.handleCategoryClick("context", item.label, `${props.primaryMetricShortLabel} por tema`)}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={props.displayContextBars}
                      layout="vertical"
                      margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name={props.primaryMetricUnitLabel} fill="#0ea5e9" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) props.handleCategoryClick("context", val, `${props.primaryMetricShortLabel} por tema`); }}>
                        <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </div>
          <div className="grid gap-4 grid-cols-1">
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div className={props.chartHeaderTextClassName}>
                  <h2 className="text-base font-semibold text-slate-900">Tom</h2>
                  <p className="text-xs text-slate-500">Apoio</p>
                </div>
                <Sparkles className="h-5 w-5 text-emerald-500" />
              </header>
              <div className={props.useCompactContentCharts ? "mt-3" : props.chartHeightClassName}>
                {props.loadingTone ? (
                  <p className="text-sm text-slate-500">Carregando tons...</p>
                ) : props.displayToneBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem tons registrados no período.</p>
                ) : props.useCompactContentCharts ? (
                  <MobileBarList
                    items={props.displayToneBars.map((item: any) => ({
                      id: item.name,
                      label: item.name,
                      value: item.value,
                      postsCount: item.postsCount,
                    }))}
                    emptyText="Sem tons registrados no período."
                    accentClassName="bg-emerald-500"
                    valueFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    dense={props.isCompactBoard}
                    onSelect={(item: any) => props.handleCategoryClick("tone", item.label, `${props.primaryMetricShortLabel} por tom`)}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={props.displayToneBars}
                      layout="vertical"
                      margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name={props.primaryMetricUnitLabel} fill="#10b981" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) props.handleCategoryClick("tone", val, `${props.primaryMetricShortLabel} por tom`); }}>
                        <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={cardBase}>
              <header className="flex items-center justify-between gap-3">
                <div className={props.chartHeaderTextClassName}>
                  <h2 className="text-base font-semibold text-slate-900">Referência</h2>
                  <p className="text-xs text-slate-500">Apoio</p>
                </div>
                <Sparkles className="h-5 w-5 text-amber-500" />
              </header>
              <div className={props.useCompactContentCharts ? "mt-3" : props.chartHeightClassName}>
                {props.loadingReference ? (
                  <p className="text-sm text-slate-500">Carregando referências...</p>
                ) : props.displayReferenceBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem referências registradas.</p>
                ) : props.useCompactContentCharts ? (
                  <MobileBarList
                    items={props.displayReferenceBars.map((item: any) => ({
                      id: item.name,
                      label: item.name,
                      value: item.value,
                      postsCount: item.postsCount,
                    }))}
                    emptyText="Sem referências registradas."
                    accentClassName="bg-amber-500"
                    valueFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    dense={props.isCompactBoard}
                    onSelect={(item: any) => props.handleCategoryClick("references", item.label, `${props.primaryMetricShortLabel} por referência`)}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={props.displayReferenceBars}
                      layout="vertical"
                      margin={{ top: 6, right: 80, left: 30, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name={props.primaryMetricUnitLabel} fill="#f59e0b" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) props.handleCategoryClick("references", val, `${props.primaryMetricShortLabel} por referência legada`); }}>
                        <LabelList dataKey="value" position="right" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">O que mais pesa</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Aqui vale olhar objetivo, jeito de contar, prova e venda.
          </p>
        </div>
        <div className="grid gap-4 grid-cols-1">
          {STRATEGIC_CATEGORY_CARDS.map((config: any) => {
            const rowsByField: Record<string, any[]> = {
              format: [],
              proposal: [],
              context: [],
              tone: [],
              references: [],
              contentIntent: props.contentIntentBars,
              narrativeForm: props.narrativeFormBars,
              contentSignals: props.contentSignalsBars,
              stance: props.stanceBars,
              proofStyle: props.proofStyleBars,
              commercialMode: props.commercialModeBars,
            };

            return (
              <CategoryPerformanceCard
                key={config.field}
                config={config}
                rows={rowsByField[config.field] || []}
                isLoading={props.loadingPosts}
                isMobileViewport={props.useCompactContentCharts}
                primaryMetricShortLabel={props.primaryMetricShortLabel}
                primaryMetricUnitLabel={props.primaryMetricUnitLabel}
                onCategoryClick={props.handleCategoryClick}
                chartHeaderTextClassName={props.chartHeaderTextClassName}
                chartHeightClassName={props.chartHeightClassName}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function PlanningFormatDesktopSection(props: any) {
  const UserAvatar = props.UserAvatarComponent as React.ComponentType<any>;

  return (
    <div className="space-y-3.5">
      <section className="space-y-3">
        <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Padrão para repetir</p>
        </div>
        <div className="grid gap-4 grid-cols-1">
          <div className="min-w-0 space-y-4">
            <article className={formatCardBase}>
              <header className="flex items-center justify-between gap-3">
                <div className={props.chartHeaderTextClassName}>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Horário</h2>
                    {props.bestHour !== null && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        Melhor: {props.bestHour}h
                      </span>
                    )}
                  </div>
                  {!props.useCompactFormatCharts && props.timingBenchmark?.cohort?.reason ? (
                    <p className="text-[11px] text-slate-400">{props.timingBenchmark.cohort.reason}</p>
                  ) : null}
                </div>
                <Clock3 className="h-5 w-5 text-emerald-500" />
              </header>
              {props.timingBenchmarkEnabled ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {props.bestHour !== null ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${props.benchmarkToneClassName[props.bestHourBenchmarkStatus.tone]}`}
                    >
                      {props.bestHourBenchmarkStatus.label}
                    </span>
                  ) : null}
                  {props.benchmarkMetaLine && !props.useCompactFormatCharts ? (
                    <span className="inline-flex max-w-full whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {props.benchmarkMetaLine}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className={props.useCompactFormatCharts ? "mt-3" : props.chartHeightClassName}>
                {props.loadingTime ? (
                  <p className="text-sm text-slate-500">Carregando horários...</p>
                ) : props.hourBars.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">Sem dados no período.</p>
                    {props.timePeriod !== "all_time" ? (
                      <button
                        type="button"
                        onClick={() => props.handleTimePeriodChange("all_time")}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ver todo histórico
                      </button>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Publique mais para liberar leitura.
                      </p>
                    )}
                  </div>
                ) : props.useCompactFormatCharts ? (
                  <MobileBarList
                    items={props.mobileHourItems}
                    emptyText="Sem dados no período."
                    accentClassName="bg-sky-500"
                    valueFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    dense={props.isCompactBoard}
                    maxItems={props.isCompactBoard ? 3 : 4}
                    onSelect={(item: any) => {
                      const hour = Number(item.label.replace("h", ""));
                      if (Number.isFinite(hour)) {
                        props.handleHourClick(hour, `Melhor horário para ${props.primaryMetricShortLabel.toLowerCase()}`);
                      }
                    }}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={props.hourBenchmarkSeries}
                      margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(h: number) => `${h}h`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: string | number, payload: any[]) => {
                          const postsCount = payload?.[0]?.payload?.postsCount;
                          const benchmarkPostsCount = payload?.[0]?.payload?.benchmarkPostsCount;
                          const benchmarkInfo =
                            props.timingBenchmarkEnabled && typeof benchmarkPostsCount === "number" && benchmarkPostsCount > 0
                              ? ` • base de comparação: ${formatPostsCount(benchmarkPostsCount)}`
                              : "";
                          return typeof postsCount === "number"
                            ? `${label}h • ${formatPostsCount(postsCount)}${benchmarkInfo}`
                            : `${label}h`;
                        }}
                        formatter={(value: number, name: string) => [
                          numberFormatter.format(Math.round(value)),
                          name === "benchmarkAverage" ? "Linha pontilhada: média de contas parecidas com a sua" : props.primaryMetricTooltipLabel,
                        ]}
                      />
                      <Bar
                        dataKey="average"
                        name={props.primaryMetricTooltipLabel}
                        fill="#0ea5e9"
                        radius={[6, 6, 0, 0]}
                        onClick={(state: any) => {
                          const hour = typeof state?.payload?.hour === "number" ? state.payload.hour : null;
                          if (hour !== null) {
                            props.handleHourClick(hour, `Melhor horário para ${props.primaryMetricShortLabel.toLowerCase()}`);
                          }
                        }}
                      >
                        <LabelList
                          dataKey="postsCount"
                          position="top"
                          formatter={(value: number) => numberFormatter.format(Math.max(0, Math.round(value)))}
                          fill="#64748b"
                          fontSize={10}
                        />
                      </Bar>
                      {props.timingBenchmarkEnabled ? (
                        <Line
                          type="monotone"
                          dataKey="benchmarkAverage"
                          name="benchmarkAverage"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="4 4"
                          activeDot={{ r: 3 }}
                        />
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={formatCardBase}>
              <header className="flex items-center justify-between gap-3">
                <div className={props.chartHeaderTextClassName}>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Duração</h2>
                    {props.bestDurationBucket ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        Melhor: {props.bestDurationBucket.label}
                      </span>
                    ) : null}
                  </div>
                </div>
                <LineChartIcon className="h-5 w-5 text-indigo-500" />
              </header>
              {props.timingBenchmarkEnabled && props.bestDurationBucket ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${props.benchmarkToneClassName[props.bestDurationBenchmarkStatus.tone]}`}
                  >
                    {props.bestDurationBenchmarkStatus.label}
                  </span>
                  {props.benchmarkMetaLine && !props.useCompactFormatCharts ? (
                    <span className="inline-flex max-w-full whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {props.benchmarkMetaLine}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className={props.useCompactFormatCharts ? "mt-3" : props.chartHeightClassName}>
                {props.loadingDuration ? (
                  <p className="text-sm text-slate-500">Carregando duração dos vídeos...</p>
                ) : props.durationSummary.totalVideoPosts === 0 ? (
                  <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
                ) : props.durationSummary.totalPostsWithDuration === 0 ? (
                  <p className="text-sm text-slate-500">Sem base para comparar.</p>
                ) : props.useCompactFormatCharts ? (
                  <MobileBarList
                    items={props.mobileDurationItems}
                    emptyText="Sem base para comparar."
                    accentClassName="bg-violet-500"
                    valueFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    dense={props.isCompactBoard}
                    maxItems={props.isCompactBoard ? 3 : undefined}
                    onSelect={(item: any) => {
                      const bucket = props.DURATION_BUCKETS.find((entry: any) => entry.label === item.label);
                      if (bucket) {
                        props.handleDurationBucketClick(bucket.key, `${props.primaryMetricShortLabel} por faixa de duração`);
                      }
                    }}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={props.durationBenchmarkSeries}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state: any) => {
                        const label = state?.activeLabel ? String(state.activeLabel) : null;
                        if (!label) return;
                        const bucket = props.DURATION_BUCKETS.find((item: any) => item.label === label);
                        if (!bucket) return;
                        props.handleDurationBucketClick(bucket.key, `${props.primaryMetricShortLabel} por faixa de duração`);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: string | number, payload: any[]) => {
                          const postsCount = payload?.[0]?.payload?.postsCount ?? 0;
                          const benchmarkPostsCount = payload?.[0]?.payload?.benchmarkPostsCount ?? 0;
                          return `${label} • ${formatPostsCount(postsCount)}${
                            props.timingBenchmarkEnabled && benchmarkPostsCount > 0
                              ? ` • base de comparação: ${formatPostsCount(benchmarkPostsCount)}`
                              : ""
                          }`;
                        }}
                        formatter={(value: number, name: string) => [
                          numberFormatter.format(Math.round(value)),
                          name === "benchmarkAverage" ? "Linha pontilhada: média de contas parecidas com a sua" : props.primaryMetricTooltipLabel,
                        ]}
                      />
                      <Bar
                        dataKey="averageInteractions"
                        name={props.primaryMetricTooltipLabel}
                        stroke="#7c3aed"
                        fill="#7c3aed"
                        radius={[6, 6, 0, 0]}
                      >
                        <LabelList
                          dataKey="averageInteractions"
                          position="top"
                          formatter={(value: number) => numberFormatter.format(Math.round(value))}
                          fill="#64748b"
                          fontSize={10}
                        />
                      </Bar>
                      {props.timingBenchmarkEnabled ? (
                        <Line
                          type="monotone"
                          dataKey="benchmarkAverage"
                          name="benchmarkAverage"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="4 4"
                          activeDot={{ r: 3 }}
                        />
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
            <article className={formatCardBase}>
              <header className="flex items-center justify-between gap-3">
                <div className={props.chartHeaderTextClassName}>
                  <h2 className="text-base font-semibold text-slate-900">Formato</h2>
                </div>
                <LineChartIcon className="h-5 w-5 text-amber-500" />
              </header>
              {props.timingBenchmarkEnabled ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {props.formatBars.length > 0 ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${props.benchmarkToneClassName[props.bestFormatBenchmarkStatus.tone]}`}
                    >
                      {props.bestFormatBenchmarkStatus.label}
                    </span>
                  ) : null}
                  {props.benchmarkMetaLine && !props.useCompactFormatCharts ? (
                    <span className="inline-flex max-w-full whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {props.benchmarkMetaLine}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className={props.useCompactFormatCharts ? "mt-3" : props.chartHeightClassName}>
                {props.loadingFormat ? (
                  <p className="text-sm text-slate-500">Carregando formatos...</p>
                ) : props.formatBars.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem formato no período.</p>
                ) : props.useCompactFormatCharts ? (
                  <MobileBarList
                    items={props.formatBars.map((item: any) => ({
                      id: item.name,
                      label: item.name,
                      value: item.value,
                      postsCount: item.postsCount,
                    }))}
                    emptyText="Sem formato no período."
                    accentClassName="bg-orange-500"
                    valueFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    dense={props.isCompactBoard}
                    maxItems={props.isCompactBoard ? 3 : undefined}
                    onSelect={(item: any) => props.handleCategoryClick("format", item.label, `${props.primaryMetricShortLabel} por formato`)}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={props.formatBenchmarkSeries}
                      margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: string | number, payload: any[]) => {
                          const benchmarkPostsCount = payload?.[0]?.payload?.benchmarkPostsCount ?? 0;
                          return `${label}${
                            props.timingBenchmarkEnabled && benchmarkPostsCount > 0
                              ? ` • grupo: ${formatPostsCount(benchmarkPostsCount)}`
                              : ""
                          }`;
                        }}
                        formatter={(value: number, name: string) => [
                          numberFormatter.format(Math.round(value)),
                          name === "benchmarkAverage" ? "Linha pontilhada: média de contas parecidas com a sua" : props.primaryMetricUnitLabel,
                        ]}
                      />
                      <Bar dataKey="value" name={props.primaryMetricUnitLabel} fill="#f97316" radius={[6, 6, 0, 0]} onClick={(state: any) => { const val = state?.payload?.name ? String(state.payload.name) : null; if (val) props.handleCategoryClick("format", val, `${props.primaryMetricShortLabel} por formato`); }}>
                        <LabelList dataKey="value" position="top" formatter={(v: number) => numberFormatter.format(Math.round(v))} fill="#64748b" fontSize={11} />
                      </Bar>
                      {props.canShowFormatBenchmarkLine ? (
                        <Line
                          type="monotone"
                          dataKey="benchmarkAverage"
                          name="benchmarkAverage"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="4 4"
                          activeDot={{ r: 3 }}
                        />
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Consistência e comparação</p>
        </div>
        <div className="min-w-0 space-y-4">
          <article className={formatCardBase}>
            <header className="flex items-center justify-between gap-3">
              <div className={props.chartHeaderTextClassName}>
                <h2 className="text-base font-semibold text-slate-900 leading-tight">Semana</h2>
              </div>
              <Clock3 className="h-5 w-5 text-indigo-500" />
            </header>
            {props.timingBenchmarkEnabled && props.benchmarkMetaLine && !props.useCompactFormatCharts ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex max-w-full whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {props.benchmarkMetaLine}
                </span>
              </div>
            ) : null}
            {props.useCompactFormatCharts ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{props.heatmapExecutiveSummary.text}</p> : null}
            <div className="mt-3">
              {props.loadingTime ? (
                <p className="text-sm text-slate-500">Carregando mapa de horários...</p>
              ) : props.heatmap.length === 0 ? (
                <p className="text-sm text-slate-500">Sem base para o mapa.</p>
              ) : props.useCompactFormatCharts ? (
                <MobileBarList
                  items={props.mobileWeekWindowItems}
                  emptyText="Sem base para o mapa."
                  accentClassName="bg-indigo-500"
                  valueFormatter={(value: number) => `${Math.round(value)} pts`}
                  dense={props.isCompactBoard}
                  maxItems={props.isCompactBoard ? 3 : 6}
                  onSelect={(item: any) => {
                    const match = item.id.match(/^week-(\d+)-(\d+)$/);
                    if (!match) return;
                    const dow = Number(match[1]);
                    const startHour = Number(match[2]);
                    props.handleDayHourClick(dow, startHour, Math.min(startHour + 3, 23), "Mapa de horários");
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[1.2rem] border border-zinc-100/90 bg-zinc-50/62 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Melhores janelas</p>
                    <div className="mt-3">
                      <MobileBarList
                        items={props.mobileWeekWindowItems}
                        emptyText="Sem base para o mapa."
                        accentClassName="bg-indigo-500"
                        valueFormatter={(value: number) => `${Math.round(value)} pts`}
                        maxItems={3}
                        onSelect={(item: any) => {
                          const match = item.id.match(/^week-(\d+)-(\d+)$/);
                          if (!match) return;
                          const dow = Number(match[1]);
                          const startHour = Number(match[2]);
                          props.handleDayHourClick(dow, startHour, Math.min(startHour + 3, 23), "Mapa de horários");
                        }}
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[320px] grid-cols-7 gap-1 text-[11px] text-slate-500">
                      <div />
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="text-center">{`${idx * 4}h`}</div>
                      ))}
                      {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
                        <React.Fragment key={dow}>
                          <div className="pr-2 text-right">{WEEKDAY_SHORT_SUN_FIRST[dow - 1] || `Dia ${dow}`}</div>
                          {Array.from({ length: 6 }).map((_, hIdx) => {
                            const h = hIdx * 4;
                            const startHour = h;
                            const endHour = Math.min(h + 3, 23);
                            const windowPoints = props.heatmap.filter((curr: any) => curr.day === dow && curr.hour >= startHour && curr.hour <= endHour);
                            const score = windowPoints.length
                              ? windowPoints.reduce((sum: number, curr: any) => sum + curr.score, 0) / windowPoints.length
                              : 0;
                            const bg = `rgba(14,165,233,${0.12 + score * 0.6})`;
                            const isBenchmarkWindow = props.benchmarkTopWindowKeys.has(`${dow}:${startHour}`);
                            return (
                              <button
                                key={hIdx}
                                type="button"
                                className={`aspect-square rounded border transition hover:border-slate-300 ${
                                  isBenchmarkWindow ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-100"
                                }`}
                                style={{ background: bg }}
                                onClick={() => props.handleDayHourClick(dow, startHour, endHour, "Mapa de horários")}
                                aria-label={`Posts em ${WEEKDAY_LONG_SUN_FIRST[dow - 1] || `Dia ${dow}`} entre ${startHour}h e ${endHour}h`}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </article>
          <article className={formatCardBase}>
            <header className="flex items-center justify-between gap-3">
              <div className={props.chartHeaderTextClassName}>
                <h2 className="text-base font-semibold text-slate-900">Cobertura de duração</h2>
                {props.durationSummary.totalVideoPosts > 0 ? (
                  <p className="text-xs text-slate-500">{(props.durationSummary.durationCoverageRate * 100).toFixed(0)}% lidos</p>
                ) : null}
              </div>
              <Clock3 className="h-5 w-5 text-cyan-500" />
            </header>
            {props.timingBenchmarkEnabled && props.benchmarkMetaLine && !props.useCompactFormatCharts ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {props.benchmarkMetaLine}
                </span>
              </div>
            ) : null}
            <div className={props.useCompactFormatCharts ? "mt-3" : props.chartCompactHeightClassName}>
              {props.loadingDuration ? (
                <p className="text-sm text-slate-500">Carregando duração dos vídeos...</p>
              ) : props.durationSummary.totalVideoPosts === 0 ? (
                <p className="text-sm text-slate-500">Sem vídeos no período selecionado.</p>
              ) : props.durationSummary.totalPostsWithDuration === 0 ? (
                <p className="text-sm text-slate-500">
                  Leitura de duração indisponível.
                </p>
              ) : props.useCompactFormatCharts ? (
                <MobileBarList
                  items={props.mobileDurationCoverageItems}
                  emptyText="Leitura de duração indisponível."
                  accentClassName="bg-cyan-500"
                  valueFormatter={(value: number) => formatPercentLabel(value)}
                  dense={props.isCompactBoard}
                  maxItems={props.isCompactBoard ? 3 : undefined}
                  onSelect={(item: any) => {
                    const bucket = props.DURATION_BUCKETS.find((entry: any) => entry.label === item.label);
                    if (bucket) {
                      props.handleDurationBucketClick(bucket.key, "Vídeos por faixa de duração");
                    }
                  }}
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={props.durationCoverageBenchmarkSeries} margin={{ top: 20, right: 8, left: -6, bottom: 0 }} style={{ cursor: "pointer" }}>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value: number) => formatPercentLabel(value)}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label: string | number, payload: any[]) => {
                        const postsCount = payload?.[0]?.payload?.postsCount ?? 0;
                        const benchmarkPostsCount = payload?.[0]?.payload?.benchmarkUsagePosts ?? 0;
                        return `${label} • ${formatPostsCount(postsCount)}${
                          props.timingBenchmarkEnabled && benchmarkPostsCount > 0
                            ? ` • grupo: ${formatPostsCount(benchmarkPostsCount)}`
                            : ""
                        }`;
                      }}
                      formatter={(value: number, name: string) => [
                        formatPercentLabel(value, 1),
                        name === "benchmarkUsageSharePct" ? "Linha pontilhada: % dos videos desse grupo" : "% dos seus videos",
                      ]}
                    />
                    <Bar
                      dataKey="usageSharePct"
                      name="usageSharePct"
                      fill="#06b6d4"
                      radius={[6, 6, 0, 0]}
                      onClick={(state: any) => {
                        const bucketKey = state?.payload?.key;
                        if (bucketKey) props.handleDurationBucketClick(bucketKey, "Vídeos por faixa de duração");
                      }}
                    >
                      <LabelList
                        dataKey="usageSharePct"
                        position="top"
                        formatter={(value: number) => formatPercentLabel(value)}
                        fill="#64748b"
                        fontSize={10}
                      />
                    </Bar>
                    {props.timingBenchmarkEnabled ? (
                      <Line
                        type="monotone"
                        dataKey="benchmarkUsageSharePct"
                        name="benchmarkUsageSharePct"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="4 4"
                        activeDot={{ r: 3 }}
                      />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
          <article className={formatCardBase}>
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-700" />
                  <h2 className="text-base font-semibold text-slate-900">Criadores similares</h2>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {props.totalSimilarCreatorsCount > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200/80 bg-zinc-50/78 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {props.similarCreatorsSummaryLabel}
                  </span>
                ) : null}
              </div>
            </header>
            <div className="mt-4 rounded-[1.35rem] border border-zinc-100/90 bg-zinc-50/56 p-2 sm:p-3">
              {props.loadingBatch && !props.chartsBatchData ? (
                <p className="px-2 py-8 text-sm text-slate-500">Carregando base...</p>
              ) : props.similarCreatorsEnabled ? (
                <div className="space-y-2">
                  {props.similarCreators?.reason ? (
                    <div className="rounded-[1rem] border border-amber-200/80 bg-amber-50/78 px-3 py-2 text-xs text-amber-800">
                      {props.similarCreators.reason}
                    </div>
                  ) : null}
                  <ol className="space-y-1">
                    {props.similarCreatorItems.map((creator: any) => {
                      const creatorName = creator.name || creator.username || "Criador similar";
                      const creatorHandle = creator.username ? `@${creator.username}` : "Conta parecida";
                      return (
                        <li
                          key={creator.id}
                          className="flex min-w-0 flex-wrap items-center gap-3 rounded-[1.1rem] border border-zinc-100/90 bg-zinc-50/72 px-3 py-3 sm:flex-nowrap"
                        >
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                            #{creator.rankByFollowers}
                          </span>
                          <UserAvatar
                            name={creatorName}
                            src={creator.avatarUrl || null}
                            size={44}
                            className="h-11 w-11 rounded-full ring-1 ring-slate-200"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{creatorName}</p>
                            <p className="truncate text-xs text-slate-500">
                              {creatorHandle} • {formatCompactFollowers(creator.followers)}
                            </p>
                          </div>
                          {creator.mediaKitSlug ? (
                            <a
                              href={`/mediakit/${creator.mediaKitSlug}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() =>
                                track("planning_similar_creator_mediakit_clicked", {
                                  creator_id: props.activeUserId || null,
                                  similar_creator_id: creator.id,
                                  rank: creator.rankByFollowers,
                                })
                              }
                              className="inline-flex min-h-[36px] w-full items-center justify-center gap-1 rounded-full border border-zinc-200/80 bg-white/84 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-zinc-300 hover:bg-white sm:w-auto sm:shrink-0"
                            >
                              Mídia kit
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="inline-flex min-h-[36px] w-full items-center justify-center rounded-full border border-zinc-200/80 bg-zinc-50/68 px-3 py-1.5 text-xs font-medium text-slate-500 sm:w-auto sm:shrink-0">
                              Sem mídia kit
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <div className="rounded-[1.1rem] border border-zinc-100/90 bg-white/76 px-4 py-6 text-sm text-slate-500">
                  {props.similarCreators?.reason || "Ainda faltam contas parecidas suficientes para montar esse ranking."}
                </div>
              )}
              {props.canShowAffiliateInvite ? (
                <div className="mt-3 rounded-[1.1rem] border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.62)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Gift className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900">Convide pares</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        Amplie sua base com o seu link.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={props.handleCopyAffiliateInvite}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar link de convite
                    </button>
                    <a
                      href="/dashboard/afiliados"
                      className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white/84 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      Ver afiliados
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Código: <span className="font-semibold text-slate-700">{props.viewer?.affiliateCode ?? "—"}</span>
                  </p>
                  {props.affiliateCopyStatus === "copied" ? (
                    <p className="mt-2 text-xs font-medium text-emerald-700">Link copiado. Você já pode compartilhar.</p>
                  ) : props.affiliateCopyStatus === "error" ? (
                    <p className="mt-2 text-xs font-medium text-amber-700">Não deu para copiar agora. Tente novamente.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export function PlanningAudienceSection(props: any) {
  const TopDiscoveryTable = props.TopDiscoveryTableComponent as React.ComponentType<any>;

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Leitura da audiência</p>
        </div>
        <div className="grid items-start gap-4 grid-cols-1">
          <article className={cardBase}>
            <header className="flex items-center justify-between gap-3">
              <div className={props.chartHeaderTextClassName}>
                <h2 className="text-base font-semibold text-slate-900">Alcance x resposta</h2>
                <p className="text-xs text-slate-500">
                  Direita = mais gente alcançada. Alto = {props.objectiveMode === "leads" ? "mais intenção de lead" : "mais resposta"}.
                </p>
              </div>
              <Target className="h-5 w-5 text-slate-500" />
            </header>
            <div className={props.chartTallHeightClassName}>
              {props.strategyMatrix.points.length === 0 ? (
                <p className="text-sm text-slate-500">Ainda faltam posts suficientes para comparar alcance e profundidade.</p>
              ) : (
                <div className="relative h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 16, right: 12, left: 0, bottom: 14 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="reach"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                        name="Pessoas alcançadas"
                      />
                      <YAxis
                        type="number"
                        dataKey="depth"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickFormatter={(value: number) => value.toFixed(value >= 10 ? 0 : 1)}
                        name={props.strategyMatrix.depthLabel}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => [
                          name === "Pessoas alcançadas"
                            ? numberFormatter.format(Math.round(value))
                            : value.toFixed(value >= 10 ? 1 : 2),
                          name,
                        ]}
                        labelFormatter={(_label: string | number, payload: any[]) => payload?.[0]?.payload?.label || "Post"}
                      />
                      <ReferenceLine x={props.strategyMatrix.reachMedian} stroke="#cbd5e1" strokeDasharray="4 4" />
                      <ReferenceLine y={props.strategyMatrix.depthMedian} stroke="#cbd5e1" strokeDasharray="4 4" />
                      <Scatter
                        data={props.strategyMatrix.points}
                        name="Pessoas alcançadas"
                        shape={(shapeProps: any) => (
                          <circle
                            cx={shapeProps.cx}
                            cy={shapeProps.cy}
                            r={props.isMobileViewport ? 8 : 5}
                            fill={shapeProps.payload.fill}
                            fillOpacity={0.9}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            className="cursor-pointer"
                            onClick={() => props.handleStrategyPointClick(shapeProps.payload)}
                          />
                        )}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-zinc-100/90 bg-white/82 px-2 py-1 text-[10px] font-semibold text-slate-600">
                    Mais resposta
                  </div>
                  <div className="pointer-events-none absolute bottom-0 right-2 rounded-full border border-zinc-100/90 bg-white/82 px-2 py-1 text-[10px] font-semibold text-slate-600">
                    Mais alcance
                  </div>
                </div>
              )}
            </div>
            {props.isMobileViewport && props.mobileStrategyHighlights.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Posts que merecem atenção</p>
                {props.mobileStrategyHighlights.map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => props.handlePlayVideo(item.post)}
                    className="w-full rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2.5 text-left"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.helper}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </article>
          <div className="space-y-3">
            <article className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Leitura</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{props.strategyMatrix.summary}</p>
            </article>
            <article className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Legenda</p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-slate-700">
                <div className="rounded-lg border border-zinc-100/90 bg-zinc-50/74 px-2 py-1.5"><strong className="text-slate-900 font-bold">Azul escuro:</strong> repetir.</div>
                <div className="rounded-lg border border-zinc-100/90 bg-zinc-50/74 px-2 py-1.5"><strong className="text-slate-900 font-bold">Azul claro:</strong> atrai, mas pede ajuste.</div>
                <div className="rounded-lg border border-zinc-100/90 bg-zinc-50/74 px-2 py-1.5"><strong className="text-slate-900 font-bold">Verde:</strong> bom retorno, precisa alcance.</div>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Posts de descoberta</p>
        </div>
        <section className={audienceCardBase}>
          <header className="flex items-center justify-between gap-3">
            <div className={props.chartHeaderTextClassName}>
              <h3 className="text-base font-semibold text-slate-900">Posts de descoberta</h3>
            </div>
            <Sparkles className="h-5 w-5 text-indigo-500" />
          </header>
          {props.loadingPosts ? (
            <p className="mt-3 text-sm text-slate-500">Carregando lista...</p>
          ) : (
            <TopDiscoveryTable posts={props.topDiscovery} isLoading={props.loadingPosts} />
          )}
        </section>
      </section>
      <section className="space-y-3">
        <div className="rounded-[1.45rem] border border-zinc-100/90 bg-zinc-50/68 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Evolução e sinais</p>
        </div>
        <section className="grid items-start gap-4 grid-cols-1">
          <article className={audienceCardBase}>
            <header className="flex items-center justify-between gap-3">
              <div className={props.chartHeaderTextClassName}>
                <h2 className="text-base font-semibold text-slate-900">Evolução</h2>
              </div>
              <Sparkles className="h-5 w-5 text-indigo-500" />
            </header>
            {props.isMobileViewport ? (
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-zinc-100/90 bg-zinc-50/72 p-1">
                <button
                  type="button"
                  onClick={() => props.setMobileAudienceTrendMetric("reach")}
                  className={`rounded-xl px-2 py-2 text-[11px] font-bold ${props.mobileAudienceTrendMetric === "reach" ? "bg-white text-indigo-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                >
                  Alcance
                </button>
                <button
                  type="button"
                  onClick={() => props.setMobileAudienceTrendMetric("interactions")}
                  className={`rounded-xl px-2 py-2 text-[11px] font-bold ${props.mobileAudienceTrendMetric === "interactions" ? "bg-white text-indigo-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                >
                  Interações
                </button>
                <button
                  type="button"
                  onClick={() => props.setMobileAudienceTrendMetric("response")}
                  className={`rounded-xl px-2 py-2 text-[11px] font-bold ${props.mobileAudienceTrendMetric === "response" ? "bg-white text-indigo-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                >
                  Resposta
                </button>
              </div>
            ) : null}
            <div className={props.chartHeightClassName}>
              {props.loadingTrend || (props.isMobileViewport && props.mobileAudienceTrendMetric === "response" && props.loadingPosts) ? (
                <p className="text-sm text-slate-500">Carregando série...</p>
              ) : props.isMobileViewport && props.mobileAudienceTrendMetric === "response" ? (
                props.weeklyEngagementRate.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={props.weeklyEngagementRate}
                      margin={{ top: 20, right: 8, left: -6, bottom: 0 }}
                      onClick={(state: any) => props.handleWeekClick(state?.activeLabel ?? null, "Percentual de resposta")}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis dataKey="date" tickFormatter={props.formatWeekLabel} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: string | number) => props.formatWeekLabel(String(l))} />
                      <Line type="monotone" dataKey="avgRate" name="Resposta" stroke="#7c3aed" strokeWidth={3} dot>
                        <LabelList dataKey="avgRate" position="top" formatter={(v: number) => `${(v * 100).toFixed(1)}%`} fill="#64748b" fontSize={11} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                )
              ) : props.trendSeries.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados no período.</p>
              ) : props.isMobileViewport ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={props.trendSeries}
                    margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                    onClick={(state: any) =>
                      props.handleWeekClick(
                        state?.activeLabel ?? null,
                        props.mobileAudienceTrendMetric === "interactions" ? "Interações por post" : "Pessoas alcançadas por post"
                      )
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis dataKey="date" tickFormatter={props.formatWeekLabel} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label: string | number) => props.formatWeekLabel(String(label))}
                      formatter={(value: number) => [
                        numberFormatter.format(Math.round(value)),
                        props.mobileAudienceTrendMetric === "interactions" ? "Interações por post" : "Pessoas alcançadas por post",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey={props.mobileAudienceTrendMetric === "interactions" ? "interactions" : "reach"}
                      name={props.mobileAudienceTrendMetric === "interactions" ? "Interações por post" : "Pessoas alcançadas por post"}
                      stroke={props.mobileAudienceTrendMetric === "interactions" ? "#7c3aed" : "#2563eb"}
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={props.trendSeries}
                    margin={{ top: 6, right: 8, left: -6, bottom: 0 }}
                    onClick={(state: any) => props.handleWeekClick(state?.activeLabel ?? null, "Alcance x Interações")}
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis
                      dataKey="date"
                      tickFormatter={props.formatWeekLabel}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="reach"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    />
                    <YAxis
                      yAxisId="interactions"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value: number) => numberFormatter.format(Math.round(value))}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label: string | number) => props.formatWeekLabel(String(label))}
                      formatter={(value: number, name: string) => [numberFormatter.format(Math.round(value)), name]}
                    />
                    <Line yAxisId="reach" type="monotone" dataKey="reach" name="Pessoas alcançadas por post" stroke="#2563eb" strokeWidth={3} dot={false} />
                    <Line yAxisId="interactions" type="monotone" dataKey="interactions" name="Interações por post" stroke="#7c3aed" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
          <article className={`${audienceCardBase} ${props.isMobileViewport ? "hidden" : ""}`}>
            <header className="flex items-center justify-between gap-3">
              <div className={props.chartHeaderTextClassName}>
                <h2 className="text-base font-semibold text-slate-900">Resposta</h2>
              </div>
              <Sparkles className="h-5 w-5 text-indigo-500" />
            </header>
            <div className={props.chartHeightClassName}>
              {props.loadingPosts ? (
                <p className="text-sm text-slate-500">Carregando série...</p>
              ) : props.weeklyEngagementRate.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados suficientes.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={props.weeklyEngagementRate}
                    margin={{ top: 20, right: 12, left: -6, bottom: 0 }}
                    onClick={(state: any) => props.handleWeekClick(state?.activeLabel ?? null, "Percentual de resposta")}
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis dataKey="date" tickFormatter={props.formatWeekLabel} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: string | number) => props.formatWeekLabel(String(l))} />
                    <Line type="monotone" dataKey="avgRate" name="Resposta" stroke="#7c3aed" strokeWidth={3} dot>
                      <LabelList dataKey="avgRate" position="top" formatter={(v: number) => `${(v * 100).toFixed(1)}%`} fill="#64748b" fontSize={11} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
        </section>
        <section className="grid gap-3 grid-cols-1">
          <article className={audienceCardBase}>
            <header className="flex items-center justify-between gap-3">
              <div className={props.chartHeaderTextClassName}>
                <h2 className="text-base font-semibold text-slate-900">
                  {props.isMobileViewport ? (props.mobileDepthMetric === "saves" ? "Salvamentos" : "Comentários") : "Salvamentos"}
                </h2>
              </div>
              <LineChartIcon className={`h-5 w-5 ${props.isMobileViewport && props.mobileDepthMetric === "comments" ? "text-indigo-500" : "text-rose-500"}`} />
            </header>
            {props.isMobileViewport ? (
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-100/90 bg-zinc-50/72 p-1">
                <button
                  type="button"
                  onClick={() => props.setMobileDepthMetric("saves")}
                  className={`rounded-xl px-2 py-2 text-[11px] font-bold ${props.mobileDepthMetric === "saves" ? "bg-white text-rose-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                >
                  Salvamentos
                </button>
                <button
                  type="button"
                  onClick={() => props.setMobileDepthMetric("comments")}
                  className={`rounded-xl px-2 py-2 text-[11px] font-bold ${props.mobileDepthMetric === "comments" ? "bg-white text-indigo-600 ring-1 ring-zinc-100/90" : "text-slate-500"}`}
                >
                  Comentários
                </button>
              </div>
            ) : null}
            <div className={props.isMobileViewport ? "mt-3" : props.chartCompactHeightClassName}>
              {props.loadingPosts ? (
                <p className="text-sm text-slate-500">Carregando série...</p>
              ) : props.isMobileViewport && props.mobileDepthMetric === "comments" ? (
                props.commentVelocitySeries.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem dados suficientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={props.commentVelocitySeries}
                      margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                      onClick={(state: any) => props.handleWeekClick(state?.activeLabel ?? null, "Média de comentários por semana")}
                      style={{ cursor: "pointer" }}
                    >
                      <XAxis
                        dataKey="date"
                        tickFormatter={props.formatWeekLabel}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label: string | number) => props.formatWeekLabel(String(label))}
                        formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Comentários médios"]}
                      />
                      <Line type="monotone" dataKey="avgComments" name="Comentários médios" stroke="#6366f1" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )
              ) : props.saveVelocitySeries.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados suficientes.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={props.saveVelocitySeries}
                    margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                    onClick={(state: any) => props.handleWeekClick(state?.activeLabel ?? null, "Média de salvamentos por semana")}
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis
                      dataKey="date"
                      tickFormatter={props.formatWeekLabel}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value: number) => numberFormatter.format(value)}
                      label={props.isMobileViewport ? undefined : { value: "Salvamentos médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label: string | number) => props.formatWeekLabel(String(label))}
                      formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Salvamentos médios"]}
                    />
                    <Line type="monotone" dataKey="avgSaves" name="Salvamentos médios" stroke="#ec4899" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
          <article className={`${audienceCardBase} ${props.isMobileViewport ? "hidden" : ""}`}>
            <header className="flex items-center justify-between gap-3">
              <div className={props.chartHeaderTextClassName}>
                <h2 className="text-base font-semibold text-slate-900">Comentários</h2>
              </div>
              <LineChartIcon className="h-5 w-5 text-indigo-500" />
            </header>
            <div className={props.isMobileViewport ? "mt-3" : props.chartCompactHeightClassName}>
              {props.loadingPosts ? (
                <p className="text-sm text-slate-500">Carregando série...</p>
              ) : props.commentVelocitySeries.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados suficientes.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={props.commentVelocitySeries}
                    margin={{ top: 6, right: 12, left: -6, bottom: 0 }}
                    onClick={(state: any) => props.handleWeekClick(state?.activeLabel ?? null, "Média de comentários por semana")}
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis
                      dataKey="date"
                      tickFormatter={props.formatWeekLabel}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value: number) => numberFormatter.format(value)}
                      label={props.isMobileViewport ? undefined : { value: "Comentários médios", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label: string | number) => props.formatWeekLabel(String(label))}
                      formatter={(value: number) => [numberFormatter.format(Math.round(value)), "Comentários médios"]}
                    />
                    <Line type="monotone" dataKey="avgComments" name="Comentários médios" stroke="#6366f1" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
          <article className={audienceCardBase}>
            <header className="flex items-center justify-between gap-3">
              <div className={props.chartHeaderTextClassName}>
                <h2 className="text-base font-semibold text-slate-900">Compartilhamentos</h2>
              </div>
              <Sparkles className="h-5 w-5 text-amber-500" />
            </header>
            <div className={props.chartCompactHeightClassName}>
              {props.loadingPosts ? (
                <p className="text-sm text-slate-500">Carregando dados...</p>
              ) : props.deepEngagement.length === 0 ? (
                <p className="text-sm text-slate-500">Sem dados suficientes.</p>
              ) : props.isMobileViewport ? (
                <MobileBarList
                  items={props.deepEngagement.map((item: any) => ({
                    id: item.format,
                    label: item.format,
                    value: item.sharesPerThousand,
                  }))}
                  emptyText="Sem dados suficientes."
                  accentClassName="bg-sky-500"
                  valueFormatter={(value: number) => value.toFixed(1)}
                  onSelect={(item: any) => props.handleCategoryClick("format", item.label, "Compartilhamentos por formato")}
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={props.deepEngagement}
                    layout="vertical"
                    margin={{ top: 6, right: 12, left: 40, bottom: 0 }}
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="format" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="sharesPerThousand" name="Compartilhamentos" fill="#0ea5e9" radius={[0, 6, 6, 0]} onClick={(state: any) => { const val = state?.payload?.format ? String(state.payload.format) : null; if (val) props.handleCategoryClick("format", val, "Compartilhamentos por formato"); }}>
                      <LabelList dataKey="sharesPerThousand" position="right" formatter={(v: number) => v.toFixed(1)} fill="#64748b" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
        </section>
      </section>
    </div>
  );
}
