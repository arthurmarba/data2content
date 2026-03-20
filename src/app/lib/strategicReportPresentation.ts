import { getCategoryById, getCategoryByValue } from '@/app/lib/classification';
import { getV2CategoryByValue } from '@/app/lib/classificationV2';
import { getV25CategoryByValue } from '@/app/lib/classificationV2_5';
import type { CommunityInspiration, StrategicReport } from 'types/StrategicReport';

export type StrategicGroupingDimension =
  | 'format'
  | 'proposal'
  | 'context'
  | 'tone'
  | 'references'
  | 'contentIntent'
  | 'narrativeForm'
  | 'contentSignals'
  | 'stance'
  | 'proofStyle'
  | 'commercialMode';

type GroupingAverage = {
  dimension: StrategicGroupingDimension | string;
  name: string;
  value: number;
  postsCount: number;
};

export type StrategicQuickStat = {
  key: string;
  title: string;
  value: string;
  hint?: string;
  deltaPct?: number;
};

function mapLegacyCategoryLabel(name: string, type: 'format' | 'proposal' | 'context' | 'tone' | 'reference') {
  return getCategoryById(name, type) ?? getCategoryByValue(name, type);
}

export function formatStrategicGroupingValue(
  dimension: StrategicGroupingDimension | string,
  rawValue: string | undefined | null
): string {
  if (!rawValue) return '—';

  switch (dimension) {
    case 'format':
      return mapLegacyCategoryLabel(rawValue, 'format')?.label ?? rawValue;
    case 'proposal':
      return mapLegacyCategoryLabel(rawValue, 'proposal')?.label ?? rawValue;
    case 'context':
      return mapLegacyCategoryLabel(rawValue, 'context')?.label ?? rawValue;
    case 'tone':
      return mapLegacyCategoryLabel(rawValue, 'tone')?.label ?? rawValue;
    case 'references':
      return mapLegacyCategoryLabel(rawValue, 'reference')?.label ?? rawValue;
    case 'contentIntent':
      return getV2CategoryByValue(rawValue, 'contentIntent')?.label ?? rawValue;
    case 'narrativeForm':
      return getV2CategoryByValue(rawValue, 'narrativeForm')?.label ?? rawValue;
    case 'contentSignals':
      return getV2CategoryByValue(rawValue, 'contentSignal')?.label ?? rawValue;
    case 'stance':
      return getV25CategoryByValue(rawValue, 'stance')?.label ?? rawValue;
    case 'proofStyle':
      return getV25CategoryByValue(rawValue, 'proofStyle')?.label ?? rawValue;
    case 'commercialMode':
      return getV25CategoryByValue(rawValue, 'commercialMode')?.label ?? rawValue;
    default:
      return rawValue;
  }
}

export function getTopGroupingAverage(
  report: StrategicReport,
  dimension: StrategicGroupingDimension
): GroupingAverage | undefined {
  const groupingAverages = (report?.evidence?.groupingAverages || []) as GroupingAverage[];
  const list = groupingAverages.filter((item) => item.dimension === dimension);
  if (!list.length) return undefined;
  return [...list].sort((left, right) => (right.value ?? 0) - (left.value ?? 0))[0];
}

export function getStrategicQuickStats(report: StrategicReport): StrategicQuickStat[] {
  const timeBuckets = report?.evidence?.timeBuckets || [];
  const bestSlot =
    timeBuckets.length > 0
      ? [...timeBuckets].sort((left, right) => (right.avg ?? 0) - (left.avg ?? 0))[0]
      : undefined;
  const corrComments = report.correlations?.find((item) => item.id === 'corr_time_comments');

  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const formatHint = (item?: GroupingAverage) =>
    item ? `média ${Math.round(item.value).toLocaleString('pt-BR')} · n=${item.postsCount}` : undefined;

  const items: Array<StrategicQuickStat | null> = [
    bestSlot
      ? {
          key: 'best-slot',
          title: 'Melhor horário (interações)',
          value: `${weekdays[Math.max(1, Math.min(7, bestSlot.dayOfWeek)) - 1] || '—'} · ${bestSlot.hour}h`,
          hint: `média ${Math.round(bestSlot.avg).toLocaleString('pt-BR')} · n=${bestSlot.count}`,
        }
      : null,
    corrComments
      ? {
          key: 'comments-slot',
          title: 'Melhor horário (comentários)',
          value: corrComments.insightText,
          hint: 'Δ vs mediana',
          deltaPct: corrComments.coeffOrDelta,
        }
      : null,
    (() => {
      const top = getTopGroupingAverage(report, 'format');
      return top
        ? {
            key: 'top-format',
            title: 'Top formato',
            value: formatStrategicGroupingValue('format', top.name),
            hint: formatHint(top),
          }
        : null;
    })(),
    (() => {
      const top = getTopGroupingAverage(report, 'context');
      return top
        ? {
            key: 'top-context',
            title: 'Top contexto',
            value: formatStrategicGroupingValue('context', top.name),
            hint: formatHint(top),
          }
        : null;
    })(),
    (() => {
      const top = getTopGroupingAverage(report, 'contentIntent');
      return top
        ? {
            key: 'top-content-intent',
            title: 'Top intenção',
            value: formatStrategicGroupingValue('contentIntent', top.name),
            hint: formatHint(top),
          }
        : null;
    })(),
    (() => {
      const top = getTopGroupingAverage(report, 'narrativeForm');
      return top
        ? {
            key: 'top-narrative-form',
            title: 'Top narrativa',
            value: formatStrategicGroupingValue('narrativeForm', top.name),
            hint: formatHint(top),
          }
        : null;
    })(),
    (() => {
      const top = getTopGroupingAverage(report, 'proofStyle');
      return top
        ? {
            key: 'top-proof-style',
            title: 'Top prova',
            value: formatStrategicGroupingValue('proofStyle', top.name),
            hint: formatHint(top),
          }
        : null;
    })(),
  ];

  return items.filter((item): item is StrategicQuickStat => Boolean(item));
}

export function formatCommunityInspirationSubtitle(inspiration: CommunityInspiration): string {
  const parts = [
    formatStrategicGroupingValue('format', inspiration.format),
    inspiration.contentIntent
      ? formatStrategicGroupingValue('contentIntent', inspiration.contentIntent)
      : undefined,
    inspiration.narrativeForm
      ? formatStrategicGroupingValue('narrativeForm', inspiration.narrativeForm)
      : inspiration.proposal
        ? formatStrategicGroupingValue('proposal', inspiration.proposal)
        : undefined,
    inspiration.context ? formatStrategicGroupingValue('context', inspiration.context) : undefined,
  ].filter(Boolean) as string[];

  const uniqueParts = parts.filter((part, index) => parts.indexOf(part) === index);
  return uniqueParts.join(' · ');
}
