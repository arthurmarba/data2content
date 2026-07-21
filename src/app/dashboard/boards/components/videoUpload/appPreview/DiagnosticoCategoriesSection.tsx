"use client";

import type { ReactNode } from "react";
import type {
  DiagnosticoCollabSuggestion,
  DiagnosticoCollabSuggestionsState,
  DiagnosticoPageData,
} from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import type { NarrativeMapMobileReadingItem } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModel";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { DiagnosticoCategoryTile } from "./DiagnosticoCategoryTile";
import { DiagnosticoHeroTile } from "./DiagnosticoHeroTile";
import { DiagnosticoDeltaChip } from "./DiagnosticoDeltaChip";
import { DiagnosticoConfidenceDots } from "./DiagnosticoConfidenceDots";
import { StableCreatorAvatar } from "./StableCreatorAvatar";
import { CATEGORY_META, type CategoryId } from "./DiagnosticoCategoryMeta";
import {
  refineDiagnosticoNextMove,
  refineDiagnosticoSignal,
  refineDiagnosticoSignals,
} from "./diagnosticoDisplayText";

interface Props {
  data: DiagnosticoPageData;
  collabSuggestions?: DiagnosticoCollabSuggestionsState;
  onOpenCategory: (id: CategoryId) => void;
}

interface TileConfig {
  id: CategoryId;
  metric: string;
  metricUnit?: string;
  subtitle?: string;
  enabled: boolean;
  visual?: ReactNode;
  heroMeta?: ReactNode;
  timestamp?: string;
  bigNumber?: boolean;
  emphasis?: boolean;
}

const EXECUTION_LABEL_MAX = 50;
const METRIC_MAX_LEN = 42;

export function DiagnosticoCategoriesSection({ data, collabSuggestions, onOpenCategory }: Props) {
  const allTiles = buildTiles(data, collabSuggestions);
  if (allTiles.length === 0) return null;

  const heroIds = pickHeroIds(data);
  const heroTiles = heroIds
    .map((id) => allTiles.find((t) => t.id === id && t.enabled))
    .filter((t): t is TileConfig => Boolean(t));
  const heroIdSet = new Set(heroTiles.map((t) => t.id));
  const regularTiles = allTiles.filter((t) => !heroIdSet.has(t.id));

  return (
    <>
      {/* ── Fixado — same information, calmer Apple Health rhythm ─────────── */}
      {heroTiles.length > 0 && (
        <section aria-label="Fixado" className="flex flex-col gap-4">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-[28px] font-bold leading-none text-zinc-950">Fixado</h2>
          </div>
          {heroTiles.map((tile) => renderHero(tile, onOpenCategory))}
        </section>
      )}

      {/* ── Sua jornada — full-width cards keep scanning predictable ───────── */}
      {regularTiles.length > 0 && (
        <section aria-label="Sua jornada" className="flex flex-col gap-4">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-[28px] font-bold leading-none text-zinc-950">Sua jornada</h2>
          </div>
          {renderRegular(regularTiles, onOpenCategory)}
        </section>
      )}
    </>
  );
}

/* ── Rendering helpers ────────────────────────────────────────────────── */

function renderHero(tile: TileConfig, onOpen: (id: CategoryId) => void) {
  const meta = CATEGORY_META[tile.id];
  return (
    <DiagnosticoHeroTile
      key={tile.id}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      category={meta.category}
      catColor={meta.catColor}
      metric={tile.metric}
      meta={tile.heroMeta}
      timestamp={tile.timestamp}
      onClick={() => onOpen(tile.id)}
    />
  );
}

function renderRegular(tiles: TileConfig[], onOpen: (id: CategoryId) => void) {
  return tiles.map((tile) => renderTile(tile, onOpen));
}

function renderTile(
  tile: TileConfig,
  onOpen: (id: CategoryId) => void,
  compact = false,
) {
  const meta = CATEGORY_META[tile.id];
  return (
    <DiagnosticoCategoryTile
      key={tile.id}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      category={compact ? meta.shortCategory : meta.category}
      catColor={meta.catColor}
      metric={tile.metric}
      metricUnit={tile.metricUnit}
      subtitle={tile.subtitle}
      timestamp={compact ? undefined : tile.timestamp}
      visual={compact && tile.id !== "collabs" ? undefined : tile.visual}
      compact={compact}
      bigNumber={!compact && tile.bigNumber}
      emphasis={!compact && tile.emphasis}
      onClick={() => onOpen(tile.id)}
    />
  );
}

/* ── Hero selection ───────────────────────────────────────────────────── */

function pickHeroIds(data: DiagnosticoPageData): CategoryId[] {
  const s = data.synthesis;
  const ids: CategoryId[] = [];
  if (s.nextStrategicMove) ids.push("strategic");
  if (s.mainNarrative) ids.push("narrative");
  return ids.slice(0, 2);
}

/* ── Tile building ────────────────────────────────────────────────────── */

function buildTiles(
  data: DiagnosticoPageData,
  collabSuggestions?: DiagnosticoCollabSuggestionsState,
): TileConfig[] {
  const { synthesis: s, readings, instagramConnected, instagramMetrics, brandMatches } = data;
  const tiles: TileConfig[] = [];
  const synthesisTimestamp = relativeShort(s.generatedAt);

  // 1. Sua Narrativa
  if (s.mainNarrative) {
    const narrativeCopy = refineDiagnosticoSignal(s.mainNarrative, "narrative");
    tiles.push({
      id: "narrative",
      metric: sanitizeMetric(narrativeCopy.label),
      enabled: true,
      timestamp: synthesisTimestamp,
      visual: (
        <MiniConfidenceDots
          confidence={s.mainNarrative.confidence}
          accent="bg-orange-500"
        />
      ),
      heroMeta: (
        <DiagnosticoConfidenceDots
          confidence={s.mainNarrative.confidence}
          evidenceCount={s.mainNarrative.evidenceCount}
        />
      ),
    });
  } else {
    const emergingSignal = s.testedNarratives[0] ?? s.recurringPatterns[0] ?? null;
    if (emergingSignal && readings.length > 0) {
      const emergingCopy = refineDiagnosticoSignal(emergingSignal, "hypothesis");
      tiles.push({
        id: "narrative",
        metric: sanitizeMetric(emergingCopy.label),
        subtitle: "Hipótese em validação",
        enabled: true,
        timestamp: synthesisTimestamp,
      });
    } else {
      tiles.push({
        id: "narrative",
        metric: readings.length > 0 ? "Narrativa em leitura" : "Aguardando análise",
        subtitle: readings.length > 0
          ? "Novas análises ajudam a confirmar a narrativa dominante."
          : "Envie um vídeo para identificar o primeiro sinal.",
        enabled: false,
        emphasis: true,
      });
    }
  }

  // 2. Foco Estratégico
  if (s.nextStrategicMove) {
    const nextMoveCopy = refineDiagnosticoNextMove(s.nextStrategicMove);
    tiles.push({
      id: "strategic",
      metric: sanitizeMetric(nextMoveCopy.label),
      enabled: true,
      timestamp: synthesisTimestamp,
      heroMeta: <StrategicHeroMeta synthesis={s} />,
    });
  } else {
    tiles.push({
      id: "strategic",
      metric: readings.length > 0 ? "Próximo passo em aberto" : "Aguardando análise",
      subtitle: readings.length > 0
        ? "Com mais leituras, a D2C consegue sugerir um foco concreto."
        : "A primeira análise libera uma direção inicial.",
      enabled: false,
      emphasis: true,
    });
  }

  // 3. Como Você Executa
  if (s.executionPatterns.length > 0) {
    const executionPatterns = refineDiagnosticoSignals(s.executionPatterns, "execution");
    const top = executionPatterns[0];
    const topLabel = top?.label ?? "";
    const sanitizedLabel = sanitizeMetric(topLabel);
    const useGeneric = !topLabel || sanitizedLabel.length > EXECUTION_LABEL_MAX || topLabel.length > EXECUTION_LABEL_MAX;
    const metric = useGeneric
      ? `${s.executionPatterns.length} ${s.executionPatterns.length === 1 ? "padrão" : "padrões"}`
      : sanitizedLabel;
    const speechCount = countExecutionEvidence(executionPatterns, "speech");
    const productionCount = countExecutionEvidence(executionPatterns, "production");
    tiles.push({
      id: "execution",
      metric,
      enabled: true,
      timestamp: synthesisTimestamp,
      visual: (speechCount > 0 || productionCount > 0) ? (
        <MiniDistribution
          values={[speechCount, productionCount]}
          labels={["Fala", "Prod"]}
          accent="#d946ef"
        />
      ) : undefined,
    });
  } else {
    tiles.push({
      id: "execution",
      metric: readings.length > 0 ? "Sem padrão ainda" : "Aguardando análise",
      subtitle: readings.length > 0
        ? "Analise mais vídeos para separar estilo recorrente de caso isolado."
        : "A D2C precisa observar sua fala e produção.",
      enabled: false,
      emphasis: true,
    });
  }

  // 4. Instagram
  if (instagramConnected && instagramMetrics) {
    const reach = instagramMetrics.avgReachPerPost;
    const reachSeries = instagramMetrics.reachOverTime ?? [];
    const reachDelta = computeReachDelta(reachSeries);
    const showSparkline = shouldShowSparkline(reachSeries);

    if (reach != null) {
      tiles.push({
        id: "instagram",
        metric: formatNumber(reach),
        metricUnit: "alcance médio",
        enabled: true,
        bigNumber: true,
        timestamp: synthesisTimestamp,
        visual: showSparkline ? (
          <div className="flex flex-col items-end gap-1.5">
            {reachDelta !== null && <DiagnosticoDeltaChip deltaPct={reachDelta} />}
            <MiniBarChart data={reachSeries} accent="#0ea5e9" width={84} height={44} />
          </div>
        ) : undefined,
      });
    } else {
      tiles.push({
        id: "instagram",
        metric: "Dados em atualização",
        subtitle: "Estamos buscando sinais recentes do seu perfil.",
        enabled: false,
        emphasis: true,
      });
    }
  } else if (instagramConnected) {
    tiles.push({
      id: "instagram",
      metric: "Dados em atualização",
      subtitle: "Estamos buscando sinais recentes do seu perfil.",
      enabled: false,
      emphasis: true,
    });
  } else {
    tiles.push({
      id: "instagram",
      metric: "Instagram não conectado",
      subtitle: "Conectar melhora a leitura com contexto real de alcance.",
      enabled: false,
      emphasis: true,
    });
  }

  // 5. Marcas Recomendadas — real brand matches take priority over raw territory labels
  if (brandMatches && brandMatches.length > 0) {
    const count = brandMatches.length;
    const brandNames = brandMatches.slice(0, 3).map((m) => m.brandName).join(", ");
    tiles.push({
      id: "brands",
      metric: `${count} ${count === 1 ? "marca" : "marcas"} com fit`,
      subtitle: brandNames,
      enabled: true,
      timestamp: synthesisTimestamp,
    });
  } else if (s.commercialTerritories.length > 0) {
    const territories = refineDiagnosticoSignals(s.commercialTerritories, "commercial").map((t) => t.label);
    const metricText = formatTagsList(territories, 3);
    tiles.push({
      id: "brands",
      metric: metricText,
      enabled: true,
      timestamp: synthesisTimestamp,
    });
  } else {
    tiles.push({
      id: "brands",
      metric: "Sem sinal comercial ainda",
      subtitle: "Novas análises ajudam a revelar territórios para marcas.",
      enabled: false,
      emphasis: true,
    });
  }

  // 6. Collabs Indicadas
  if (!instagramConnected) {
    tiles.push({
      id: "collabs",
      metric: "Instagram necessário",
      subtitle: "Conecte para sugerir criadores com mais contexto.",
      enabled: true,
      timestamp: synthesisTimestamp,
    });
  } else if (collabSuggestions?.status === "blocked") {
    tiles.push({
      id: "collabs",
      metric: "Instagram necessário",
      subtitle: "Conecte para sugerir criadores com mais contexto.",
      enabled: true,
      timestamp: synthesisTimestamp,
    });
  } else if (collabSuggestions?.status === "loading" || collabSuggestions?.status === "idle") {
    tiles.push({
      id: "collabs",
      metric: "Buscando criadores",
      subtitle: "A D2C está cruzando narrativa e territórios.",
      enabled: true,
      timestamp: synthesisTimestamp,
    });
  } else if (collabSuggestions?.items.length) {
    const count = collabSuggestions.items.length;
    tiles.push({
      id: "collabs",
      metric: `${count} ${count === 1 ? "criador" : "criadores"}`,
      enabled: true,
      timestamp: synthesisTimestamp,
      visual: <MiniAvatarStack creators={collabSuggestions.items} />,
    });
  } else {
    tiles.push({
      id: "collabs",
      metric: "Sem matches ainda",
      subtitle: "A D2C precisa de mais sinais antes de sugerir criadores.",
      enabled: false,
      emphasis: true,
    });
  }

  // 7. Suas Análises — big number treatment
  if (readings.length > 0) {
    const latestReading = readings[0];
    const { data: sparklineData } = bucketReadingsAdaptive(readings, 6);
    const showSparkline = shouldShowSparkline(sparklineData);
    const lastDate = latestReading?.dateLabel ?? null;
    tiles.push({
      id: "readings",
      metric: `${readings.length}`,
      metricUnit: readings.length === 1 ? "análise feita" : "análises feitas",
      enabled: true,
      bigNumber: true,
      timestamp: lastDate && latestReading ? readingTimestampLabel(latestReading.createdAt) : undefined,
      visual: showSparkline ? (
        <MiniBarChart data={sparklineData} accent="var(--ds-color-text-secondary)" width={84} height={44} />
      ) : undefined,
    });
  }

  return tiles;
}

/* ── Hero meta — strategic chips ──────────────────────────────────────── */

function MiniAvatarStack({ creators }: { creators: DiagnosticoCollabSuggestion[] }) {
  const visible = creators.slice(0, 3);
  if (!visible.length) return null;

  return (
    <div className="flex -space-x-2" aria-label={`${visible.length} criadores sugeridos`}>
      {visible.map((creator) => (
        <span
          key={creator.id}
          className="relative flex h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-white bg-indigo-50 shadow-sm ring-1 ring-indigo-100"
        >
          <StableCreatorAvatar
            name={creator.name}
            avatarUrl={creator.avatarUrl}
            creatorId={creator.id}
            mediaKitSlug={creator.mediaKitSlug}
            fallbackText={getInitials(creator.name)}
            fallbackClassName="text-[10px] font-bold text-indigo-500"
          />
        </span>
      ))}
    </div>
  );
}

function getInitials(value?: string | null) {
  const parts = (value || "D2C").trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "D2C";
}

function StrategicHeroMeta({ synthesis: s }: { synthesis: CreatorStrategicProfileSynthesis }) {
  const experiments = s.tacticalExperiments.length;
  const tensions = s.recurringTensions.length;
  if (experiments === 0 && tensions === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {experiments > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-[12px] font-semibold text-cyan-700">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
          {experiments} {experiments === 1 ? "experimento" : "experimentos"}
        </span>
      )}
      {tensions > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {tensions} {tensions === 1 ? "atenção" : "atenções"}
        </span>
      )}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function sanitizeMetric(s: string, maxLen = METRIC_MAX_LEN): string {
  if (!s) return "";
  const cleaned = s
    .replace(/\s*->\s*/g, ", ")
    .replace(/\s*→\s*/g, ", ")
    .replace(/\s*\|\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  // Capitalize first letter of each comma-separated item — "bastidor, processo" → "Bastidor, Processo"
  // Gives "name feel" instead of raw enumeration
  const capitalized = cleaned
    .split(", ")
    .map((item) => (item.length > 0 ? item.charAt(0).toUpperCase() + item.slice(1) : item))
    .join(", ");
  if (capitalized.length <= maxLen) return capitalized;
  const truncated = capitalized.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated).trim() + "…";
}

function formatNumber(n: number): string {
  const rounded = Math.round(n);
  if (rounded >= 1_000_000) {
    const v = rounded / 1_000_000;
    return v >= 10 ? `${Math.round(v)}M` : `${v.toFixed(1)}M`;
  }
  if (rounded >= 1_000) {
    const v = rounded / 1_000;
    return v >= 10 ? `${Math.round(v)}K` : `${v.toFixed(1)}K`;
  }
  return rounded.toString();
}

function formatTagsList(tags: string[], visible: number): string {
  const visibleTags = tags.slice(0, visible).map((t) => sanitizeMetric(t, 18));
  const overflow = tags.length - visible;
  const base = visibleTags.join(" · ");
  return overflow > 0 ? `${base} · +${overflow}` : base;
}

function relativeShort(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return undefined;
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays <= 7) return `Há ${diffDays}d`;
  if (diffDays <= 30) return `Há ${Math.floor(diffDays / 7)}sem`;
  return undefined;
}

function readingTimestampLabel(createdAt: string | null | undefined): string | undefined {
  return relativeShort(createdAt);
}

/**
 * Show sparkline whenever there's at least one non-zero value.
 * The "highlighted last-active bar" pattern makes even sparse data look intentional.
 */
function shouldShowSparkline(series: number[]): boolean {
  return series.some((v) => v > 0);
}

function countExecutionEvidence(
  patterns: CreatorStrategicProfileSynthesis["executionPatterns"],
  area: "speech" | "production",
): number {
  return patterns
    .filter((pattern) => pattern.area === area)
    .reduce((total, pattern) => total + Math.max(1, pattern.evidenceCount), 0);
}

function bucketReadingsAdaptive(
  readings: NarrativeMapMobileReadingItem[],
  weeksPreferred: number,
): { data: number[]; scope: string | null } {
  if (readings.length === 0) return { data: [], scope: null };
  const dates = readings
    .map((r) => (r.createdAt ? new Date(r.createdAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  if (dates.length === 0) return { data: [], scope: null };
  const oldest = Math.min(...dates);
  const spanDays = (Date.now() - oldest) / 86_400_000;
  if (spanDays < 14) {
    return { data: bucketReadingsByDay(readings, 7), scope: "7 dias" };
  }
  return { data: bucketReadingsByWeek(readings, weeksPreferred), scope: `${weeksPreferred} sem.` };
}

function bucketReadingsByDay(readings: NarrativeMapMobileReadingItem[], days: number): number[] {
  const now = Date.now();
  const oneDay = 86_400_000;
  const buckets = new Array(days).fill(0);
  for (const r of readings) {
    if (!r.createdAt) continue;
    const date = new Date(r.createdAt);
    if (!Number.isFinite(date.getTime())) continue;
    const diffDays = Math.floor((now - date.getTime()) / oneDay);
    const bucketIdx = days - 1 - diffDays;
    if (bucketIdx >= 0 && bucketIdx < days) buckets[bucketIdx]++;
  }
  return buckets;
}

function bucketReadingsByWeek(readings: NarrativeMapMobileReadingItem[], weeks: number): number[] {
  const now = Date.now();
  const oneWeek = 7 * 86_400_000;
  const buckets = new Array(weeks).fill(0);
  for (const r of readings) {
    if (!r.createdAt) continue;
    const date = new Date(r.createdAt);
    if (!Number.isFinite(date.getTime())) continue;
    const diffWeeks = Math.floor((now - date.getTime()) / oneWeek);
    const bucketIdx = weeks - 1 - diffWeeks;
    if (bucketIdx >= 0 && bucketIdx < weeks) buckets[bucketIdx]++;
  }
  return buckets;
}

function computeReachDelta(series: number[]): number | null {
  if (series.length < 4) return null;
  const half = Math.floor(series.length / 2);
  const earlier = series.slice(0, half).filter((v) => v > 0);
  const recent = series.slice(half).filter((v) => v > 0);
  if (earlier.length === 0 || recent.length === 0) return null;
  const avgEarlier = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (avgEarlier === 0) return null;
  return (avgRecent - avgEarlier) / avgEarlier;
}

/** Mini confidence dots — 4-dot horizontal indicator (low=2, medium=3, high=4) */
function MiniConfidenceDots({
  confidence,
  accent,
}: {
  confidence: "low" | "medium" | "high";
  accent: string;
}) {
  const filled = confidence === "high" ? 4 : confidence === "medium" ? 3 : 2;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${i < filled ? accent : "bg-zinc-200"}`}
          />
        ))}
      </div>
      <span className="text-[9px] font-medium text-zinc-400 leading-none">confiança</span>
    </div>
  );
}

/** Mini distribution bars — for "Fala vs Produção" type splits */
function MiniDistribution({
  values,
  labels,
  accent,
}: {
  values: number[];
  labels: string[];
  accent: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-2" aria-hidden="true">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className="w-2.5 rounded-sm"
            style={{
              height: `${Math.max(8, (v / max) * 34)}px`,
              background: accent,
              opacity: v === max ? 1 : 0.45,
            }}
          />
          <span className="text-[9px] font-medium text-zinc-400 leading-none">
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniBarChart({
  data,
  accent,
  width,
  height,
}: {
  data: number[];
  accent: string;
  width: number;
  height: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const barWidth = Math.max(4, Math.floor((width - (data.length - 1) * 3) / data.length));

  // Apple Health pattern: highlight most-recent active bar, dim previous bars
  let lastActiveIdx = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    if ((data[i] ?? 0) > 0) { lastActiveIdx = i; break; }
  }

  return (
    <div className="flex items-end gap-[3px]" style={{ width, height }} aria-hidden="true">
      {data.map((v, i) => {
        let opacity: number;
        if (v === 0) opacity = 0.18;
        else if (i === lastActiveIdx) opacity = 1;     // current — full color
        else opacity = 0.45;                            // previous — dimmed for context
        return (
          <div
            key={i}
            className="rounded-sm"
            style={{
              width: barWidth,
              height: v === 0 ? 4 : `${Math.max(12, (v / max) * 100)}%`,
              background: accent,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
}
