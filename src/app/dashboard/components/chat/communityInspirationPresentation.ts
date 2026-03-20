import type { AnswerEvidence } from './types';
import { idsToLabels } from '@/app/lib/classification';
import { v2IdsToLabels } from '@/app/lib/classificationV2';
import { v25IdsToLabels } from '@/app/lib/classificationV2_5';

type CommunityInspiration = NonNullable<AnswerEvidence['communityInspirations']>[number];
type CommunityMetaFilters = NonNullable<NonNullable<AnswerEvidence['communityMeta']>['usedFilters']>;

function humanizeToken(value?: string | null) {
  if (!value) return '';
  const cleaned = value.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
}

function toneLabel(value?: string | null) {
  const tone = value?.toLowerCase();
  if (!tone) return '';
  const map: Record<string, string> = {
    humorous: 'Humor',
    inspirational: 'Inspiracional',
    educational: 'Educativo',
    critical: 'Crítico',
    promotional: 'Promocional',
    neutral: 'Neutro',
  };
  return map[tone] || humanizeToken(value);
}

function labelForValue(
  value: string | undefined | null,
  dimension:
    | 'format'
    | 'proposal'
    | 'context'
    | 'tone'
    | 'reference'
    | 'contentIntent'
    | 'narrativeForm'
    | 'contentSignals'
    | 'stance'
    | 'proofStyle'
    | 'commercialMode'
) {
  if (!value) return '';
  if (dimension === 'tone') return toneLabel(value);
  if (dimension === 'contentIntent') return v2IdsToLabels([value], 'contentIntent')[0] || humanizeToken(value);
  if (dimension === 'narrativeForm') return v2IdsToLabels([value], 'narrativeForm')[0] || humanizeToken(value);
  if (dimension === 'contentSignals') return v2IdsToLabels([value], 'contentSignal')[0] || humanizeToken(value);
  if (dimension === 'stance') return v25IdsToLabels([value], 'stance')[0] || humanizeToken(value);
  if (dimension === 'proofStyle') return v25IdsToLabels([value], 'proofStyle')[0] || humanizeToken(value);
  if (dimension === 'commercialMode') return v25IdsToLabels([value], 'commercialMode')[0] || humanizeToken(value);
  return idsToLabels([value], dimension)[0] || humanizeToken(value);
}

function narrativeRoleLabel(value?: CommunityInspiration['narrativeRole'] | null) {
  if (value === 'gancho') return 'Gancho';
  if (value === 'cta') return 'CTA';
  if (value === 'desenvolvimento') return 'Desenvolvimento';
  return null;
}

function resolveCommunityLine(value?: string | null) {
  if (!value) return null;
  return value.trim();
}

export function buildCommunityInspirationMetaTags(inspiration: CommunityInspiration): string[] {
  const role = narrativeRoleLabel(inspiration.narrativeRole);
  const signalLabel = (inspiration.contentSignals || [])
    .map((value) => labelForValue(value, 'contentSignals'))
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

  return [
    inspiration.primaryObjective ? `Resultado: ${humanizeToken(inspiration.primaryObjective)}` : null,
    inspiration.contentIntent ? `Objetivo: ${labelForValue(inspiration.contentIntent, 'contentIntent')}` : null,
    inspiration.narrativeForm ? `Narrativa: ${labelForValue(inspiration.narrativeForm, 'narrativeForm')}` : null,
    inspiration.context ? `Tema: ${labelForValue(inspiration.context, 'context')}` : null,
    inspiration.proofStyle ? `Prova: ${labelForValue(inspiration.proofStyle, 'proofStyle')}` : null,
    role ? `Papel: ${role}` : null,
    inspiration.format ? `Formato: ${labelForValue(inspiration.format, 'format')}` : null,
    inspiration.stance ? `Postura: ${labelForValue(inspiration.stance, 'stance')}` : null,
    inspiration.commercialMode ? `Comercial: ${labelForValue(inspiration.commercialMode, 'commercialMode')}` : null,
    signalLabel ? `Sinais: ${signalLabel}` : null,
    inspiration.tone ? `Tom: ${labelForValue(inspiration.tone, 'tone')}` : null,
    inspiration.reference ? `Referência: ${labelForValue(inspiration.reference, 'reference')}` : null,
    resolveCommunityLine(inspiration.proposal) && !inspiration.narrativeForm ? `Linha: ${resolveCommunityLine(inspiration.proposal)}` : null,
    typeof inspiration.narrativeScore === 'number' ? `Fit narrativo: ${(inspiration.narrativeScore * 100).toFixed(0)}%` : null,
    typeof inspiration.personalizationScore === 'number'
      ? `Fit perfil: ${(inspiration.personalizationScore * 100).toFixed(0)}%`
      : null,
    typeof inspiration.performanceScore === 'number'
      ? `Força comunidade: ${(inspiration.performanceScore * 100).toFixed(0)}%`
      : null,
  ].filter(Boolean) as string[];
}

export function buildCommunityHeaderMeta(options: {
  filters?: CommunityMetaFilters | null;
  fallback?: CommunityInspiration | null;
  personalizedByUserPerformance?: boolean;
}): string[] {
  const filters = options.filters || {};
  const fallback = options.fallback || null;
  const line = filters.proposal || fallback?.proposal;
  const context = filters.context || fallback?.context;
  const format = filters.format || fallback?.format;
  const tone = filters.tone || fallback?.tone;
  const reference = filters.reference || fallback?.reference;
  const contentIntent = filters.contentIntent || fallback?.contentIntent;
  const narrativeForm = filters.narrativeForm || fallback?.narrativeForm;
  const stance = filters.stance || fallback?.stance;
  const proofStyle = filters.proofStyle || fallback?.proofStyle;
  const commercialMode = filters.commercialMode || fallback?.commercialMode;
  const contentSignals = filters.contentSignals || fallback?.contentSignals?.[0];
  const narrativeQuery = filters.narrativeQuery;
  const primaryObjective = filters.primaryObjective || fallback?.primaryObjective;

  return [
    primaryObjective ? `Resultado: ${humanizeToken(primaryObjective)}` : null,
    contentIntent ? `Objetivo: ${labelForValue(contentIntent, 'contentIntent')}` : null,
    narrativeForm ? `Narrativa: ${labelForValue(narrativeForm, 'narrativeForm')}` : null,
    context ? `Tema: ${labelForValue(context, 'context')}` : null,
    proofStyle ? `Prova: ${labelForValue(proofStyle, 'proofStyle')}` : null,
    format ? `Formato: ${labelForValue(format, 'format')}` : null,
    stance ? `Postura: ${labelForValue(stance, 'stance')}` : null,
    commercialMode ? `Comercial: ${labelForValue(commercialMode, 'commercialMode')}` : null,
    contentSignals ? `Sinal: ${labelForValue(contentSignals, 'contentSignals')}` : null,
    tone ? `Tom: ${labelForValue(tone, 'tone')}` : null,
    reference ? `Referência: ${labelForValue(reference, 'reference')}` : null,
    line && !narrativeForm ? `Proposta: ${line}` : null,
    narrativeQuery ? `Resumo: ${String(narrativeQuery).slice(0, 40)}` : null,
    options.personalizedByUserPerformance ? 'Ranking: personalizado pelo seu histórico' : null,
  ].filter(Boolean) as string[];
}

export function buildCommunityQuickActions(options: {
  filters?: CommunityMetaFilters | null;
  fallback?: CommunityInspiration | null;
}): Array<{ label: string; prompt: string }> {
  const filters = options.filters || {};
  const fallback = options.fallback || null;
  const format = filters.format || fallback?.format;
  const context = filters.context || fallback?.context;
  const line = filters.proposal || fallback?.proposal;
  const contentIntent = filters.contentIntent || fallback?.contentIntent;
  const narrativeForm = filters.narrativeForm || fallback?.narrativeForm;

  return [
    contentIntent
      ? { label: `Mais ${labelForValue(contentIntent, 'contentIntent')}`, prompt: `Me traga mais inspirações com essa intenção: ${labelForValue(contentIntent, 'contentIntent')}.` }
      : null,
    narrativeForm
      ? { label: `Mais ${labelForValue(narrativeForm, 'narrativeForm')}`, prompt: `Me traga mais inspirações com essa narrativa: ${labelForValue(narrativeForm, 'narrativeForm')}.` }
      : null,
    context ? { label: `Mais ${labelForValue(context, 'context')}`, prompt: `Me traga mais inspirações nesse tema: ${labelForValue(context, 'context')}.` } : null,
    format ? { label: `Mais ${labelForValue(format, 'format')}`, prompt: `Me traga mais inspirações em formato ${labelForValue(format, 'format')}.` } : null,
    line ? { label: `Mais dessa proposta`, prompt: `Me traga mais inspirações nessa proposta: ${line}.` } : null,
  ].filter(Boolean) as Array<{ label: string; prompt: string }>;
}
