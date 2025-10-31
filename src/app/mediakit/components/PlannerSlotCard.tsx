"use client";

import React, { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FlaskConical,
  Flame,
  Settings,
  Sparkles,
  Trophy,
  Search,
} from 'lucide-react';
import { idsToLabels, getCategoryById } from '@/app/lib/classification';

export interface PlannerSlotCardProps {
  title?: string;
  themeKeyword?: string;
  categories?: { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
  expectedMetrics?: { viewsP50?: number; viewsP90?: number; sharesP50?: number };
  isExperiment?: boolean;
  status?: 'planned' | 'drafted' | 'test' | 'posted';
  formatId?: 'reel' | 'photo' | 'carousel' | 'story' | 'live' | 'long_video';
  dayOfWeek?: number; // 1..7 (7=Dom)
  blockStartHour?: number;
  heatScore?: number;
  scriptShort?: string;
  themes?: string[];
  onOpen?: () => void;
}

type TagGroup = 'format' | 'context' | 'proposal' | 'tone' | 'reference';
type AccentKey = 'interaction' | 'success' | 'innovation' | 'experience' | 'neutral';

const TAG_GROUPS: Array<{ key: TagGroup; label: string }> = [
  { key: 'format', label: 'Formato' },
  { key: 'proposal', label: 'Proposta' },
  { key: 'context', label: 'Contexto' },
  { key: 'tone', label: 'Tom' },
  { key: 'reference', label: 'Referências' },
];

const ACCENT_DEFINITIONS: Record<AccentKey, { gradient: string; accent: string; label: string }> = {
  interaction: {
    gradient: 'linear-gradient(145deg, rgba(243, 232, 255, 0.9) 0%, rgba(255, 255, 255, 0.95) 55%)',
    accent: '#6E1F93',
    label: 'Interação',
  },
  success: {
    gradient: 'linear-gradient(145deg, rgba(226, 238, 255, 0.9) 0%, rgba(255, 255, 255, 0.95) 55%)',
    accent: '#2563EB',
    label: 'Sucesso',
  },
  innovation: {
    gradient: 'linear-gradient(145deg, rgba(224, 250, 237, 0.9) 0%, rgba(255, 255, 255, 0.95) 55%)',
    accent: '#0F9D58',
    label: 'Inovação',
  },
  experience: {
    gradient: 'linear-gradient(145deg, rgba(255, 239, 218, 0.9) 0%, rgba(255, 255, 255, 0.95) 55%)',
    accent: '#F97316',
    label: 'Experiência',
  },
  neutral: {
    gradient: 'linear-gradient(145deg, rgba(246, 246, 248, 0.9) 0%, rgba(255, 255, 255, 0.95) 55%)',
    accent: '#6E1F93',
    label: 'Conteúdo',
  },
};

const PROPOSAL_TO_ACCENT: Record<string, AccentKey> = {
  call_to_action: 'interaction',
  community: 'interaction',
  testimonial: 'success',
  announcement: 'success',
  product_launch: 'success',
  tips: 'innovation',
  experiment: 'innovation',
  behind_the_scenes: 'experience',
  lifestyle: 'experience',
  storytelling: 'experience',
};

type ChipConfig = { key: string; label: string; className: string; icon: React.ReactNode };
type DetailItem = { key: string; icon: string; label: string; value: string };

function formatCompact(n?: number) {
  if (typeof n !== 'number' || !isFinite(n)) return null;
  try {
    return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  } catch {
    return String(n);
  }
}

function formatLabel(id?: string): string | undefined {
  switch (id) {
    case 'reel':
      return 'Reel';
    case 'photo':
      return 'Foto';
    case 'carousel':
      return 'Carrossel';
    case 'story':
      return 'Story';
    case 'live':
      return 'Live';
    case 'long_video':
      return 'Vídeo Longo';
    default:
      return id;
  }
}

function blockLabel(start?: number) {
  if (typeof start !== 'number') return '';
  const end = (start + 3) % 24;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(start)}–${pad(end)}`;
}

function dayShortLabel(dayOfWeek?: number) {
  if (typeof dayOfWeek !== 'number') return '';
  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  if (dayOfWeek === 7) return DAYS_PT[0];
  return DAYS_PT[dayOfWeek] || '';
}

function detectAccentKey(params: {
  themeKeyword?: string;
  themes?: string[];
  status?: PlannerSlotCardProps['status'];
  isExperiment?: boolean;
  proposalIds?: string[];
  contextLabels?: string[];
  proposalLabels?: string[];
  title?: string;
}): AccentKey {
  if (params.status === 'test' || params.isExperiment) {
    return 'innovation';
  }

  if (params.proposalIds?.length) {
    for (const proposal of params.proposalIds) {
      if (PROPOSAL_TO_ACCENT[proposal]) {
        return PROPOSAL_TO_ACCENT[proposal];
      }
    }
  }

  const parts = [
    params.themeKeyword,
    ...(params.themes ?? []),
    ...(params.contextLabels ?? []),
    ...(params.proposalLabels ?? []),
    params.title,
  ]
    .join(' ')
    .toLowerCase();

  if (parts.includes('intera') || parts.includes('engaj') || parts.includes('conversa') || parts.includes('pergunta')) {
    return 'interaction';
  }
  if (parts.includes('case') || parts.includes('resultado') || parts.includes('prova') || parts.includes('venda')) {
    return 'success';
  }
  if (parts.includes('inov') || parts.includes('teste') || parts.includes('trend') || parts.includes('novidade')) {
    return 'innovation';
  }
  if (parts.includes('experien') || parts.includes('hist') || parts.includes('bastidor') || parts.includes('rotina')) {
    return 'experience';
  }

  return 'neutral';
}

const PlannerSlotCardComponent: React.FC<PlannerSlotCardProps> = ({
  title,
  themeKeyword,
  categories,
  expectedMetrics,
  isExperiment,
  status,
  formatId,
  dayOfWeek,
  blockStartHour,
  heatScore,
  scriptShort,
  themes,
  onOpen,
}) => {
  const [expanded, setExpanded] = useState(false);

  const p50 = expectedMetrics?.viewsP50;
  const p90 = expectedMetrics?.viewsP90;

  const format = formatLabel(formatId);
  const contextLabels = idsToLabels(categories?.context, 'context');
  const proposalLabels = idsToLabels(categories?.proposal, 'proposal');
  const referenceLabels = idsToLabels(categories?.reference, 'reference');
  const toneLabel = categories?.tone ? getCategoryById(categories.tone, 'tone')?.label || categories.tone : undefined;

  const accentKey = detectAccentKey({
    themeKeyword,
    themes,
    status,
    isExperiment,
    proposalIds: categories?.proposal,
    contextLabels,
    proposalLabels,
    title,
  });
  const accent = ACCENT_DEFINITIONS[accentKey];

  const dayShort = dayShortLabel(dayOfWeek);
  const blockRange = blockLabel(blockStartHour);
  const headerTimeLabel = dayShort && blockRange ? `${dayShort} • ${blockRange}` : dayShort || blockRange || 'Slot sugerido';

  const headline = themeKeyword || themes?.[0] || proposalLabels[0] || contextLabels[0] || 'Tema sugerido';
  const fallbackTitleText = (() => {
    if (title && title.trim().length > 0) return title;
    if (themeKeyword && themeKeyword.trim().length > 0) return themeKeyword;
    const parts = [format, proposalLabels[0], contextLabels[0]].filter(Boolean);
    return parts.length ? `Sugestão: ${parts.join(' • ')}` : 'Ideia da IA pronta para postar';
  })();

  const groupedTags: Record<TagGroup, string[]> = {
    format: [],
    context: [],
    proposal: [],
    tone: [],
    reference: [],
  };
  if (format) groupedTags.format.push(format);
  contextLabels.forEach((label) => groupedTags.context.push(label));
  proposalLabels.forEach((label) => groupedTags.proposal.push(label));
  if (toneLabel) groupedTags.tone.push(toneLabel);
  referenceLabels.forEach((label) => groupedTags.reference.push(label));

  const detailItems: DetailItem[] = [];
  if (groupedTags.format[0]) detailItems.push({ key: 'format', icon: '🎬', label: 'Formato', value: groupedTags.format[0]! });
  if (groupedTags.proposal[0]) detailItems.push({ key: 'proposal', icon: '💡', label: 'Proposta', value: groupedTags.proposal[0]! });
  if (groupedTags.context[0]) detailItems.push({ key: 'context', icon: '🎭', label: 'Contexto', value: groupedTags.context[0]! });
  if (groupedTags.tone[0]) detailItems.push({ key: 'tone', icon: '🎯', label: 'Tom', value: groupedTags.tone[0]! });

  const heatBadge = (() => {
    if (typeof heatScore !== 'number') return null;
    const scorePercent = Math.round(heatScore * 100);
    if (heatScore >= 0.75) {
      return { label: `Horário campeão • ${scorePercent}%`, className: 'bg-[#E8FFF2] text-[#1D8E5D]', icon: <Trophy size={14} /> };
    }
    if (heatScore >= 0.5) {
      return { label: `Bom horário • ${scorePercent}%`, className: 'bg-[#EEF4FF] text-[#4C5BD4]', icon: <Flame size={14} /> };
    }
    return { label: `Em observação • ${scorePercent}%`, className: 'bg-[#FFF9E6] text-[#B9730F]', icon: <Eye size={14} /> };
  })();

  const statusBadge = (() => {
    if (status === 'test' || isExperiment) {
      return { label: 'Em teste', className: 'bg-[#E9F2FF] text-[#4256D0]', icon: <FlaskConical size={14} /> };
    }
    if (status === 'posted') {
      return { label: 'Publicado', className: 'bg-[#E8FFF2] text-[#1D8E5D]', icon: <CheckCircle2 size={14} /> };
    }
    return { label: 'Planejado', className: 'bg-[#F4ECFF] text-[#6E1F93]', icon: <CalendarDays size={14} /> };
  })();

  const viewsValue = formatCompact(p50);
  const additionalThemes =
    (themes || [])
      .map((theme) => theme?.trim())
      .filter((theme): theme is string => Boolean(theme) && theme !== (themeKeyword?.trim() ?? ''));

  const hasExpandableContent =
    Boolean(scriptShort && scriptShort.trim()) ||
    additionalThemes.length > 0 ||
    groupedTags.reference.length > 0 ||
    groupedTags.context.length > 1 ||
    groupedTags.proposal.length > 1 ||
    groupedTags.tone.length > 1;

  const aria = [
    fallbackTitleText,
    headline,
    headerTimeLabel,
    typeof p50 === 'number' ? `Views esperadas ${p50.toLocaleString('pt-BR')}` : null,
    typeof p90 === 'number' ? `P90 ${p90.toLocaleString('pt-BR')}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <article
      className="flex h-full flex-col gap-4 rounded-xl border border-[#ECECF2] bg-white p-4 shadow-sm transition hover:shadow-lg"
      aria-label={aria}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1C1E]">
          <Clock size={16} className="text-[#6E1F93]" />
          {headerTimeLabel}
        </div>
        {statusBadge && (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.className}`}>
            {statusBadge.icon}
            {statusBadge.label}
          </span>
        )}
      </div>

      {heatBadge && (
        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${heatBadge.className}`}>
          {heatBadge.icon}
          {heatBadge.label}
        </span>
      )}

      <div className="space-y-3">
        {themeKeyword && (
          <span
            className="inline-flex items-center gap-2 rounded-full bg-[#F2E8FF] px-3 py-1 text-xs font-semibold"
            style={{ color: accent.accent }}
          >
            <Sparkles size={14} color={accent.accent} />
            {themeKeyword}
          </span>
        )}
        <h4 className="text-sm font-semibold text-[#1C1C1E]">{fallbackTitleText}</h4>

        <div className="flex flex-wrap gap-2">
          <MetricBadge icon={<Eye size={14} />} label="Views" value={viewsValue ?? '—'} />
          {typeof p90 === 'number' && <MetricBadge icon={<Trophy size={14} />} label="P90" value={formatCompact(p90) ?? '—'} />}
        </div>

        <div className="space-y-1">
          {detailItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-sm text-[#3F3F46]">
              <span>{item.icon}</span>
              <span>
                <span className="font-semibold text-[#1C1C1E]">{item.label}:</span> {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 rounded-xl border border-[#E6E6EB] bg-[#FDFBFF] p-3">
          {TAG_GROUPS.map(({ key, label }) => {
            const values = groupedTags[key];
            if (!values.length) return null;
            return (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {values.map((value) => (
                    <span
                      key={`${key}-${value}`}
                      className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#4B4B55] shadow-sm"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {additionalThemes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Temas complementares</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {additionalThemes.map((theme) => (
                  <span
                    key={`theme-${theme}`}
                    className="inline-flex items-center rounded-full bg-[#F0ECFF] px-3 py-1 text-[11px] font-medium text-[#6E1F93]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
          {scriptShort && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Âncora sugerida</p>
              <p className="mt-1 text-sm text-[#3F3F46]">{scriptShort}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {hasExpandableContent && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#6E1F93] underline underline-offset-2 transition hover:text-[#53166F] sm:w-auto sm:justify-start"
          >
            {expanded ? <ChevronUp size={16} /> : <Search size={16} />}
            {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>
        )}
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#D62E5E] to-[#6E1F93] px-3 py-2 text-sm font-semibold text-white transition hover:from-[#c42853] hover:to-[#5a1877] sm:w-auto sm:justify-start"
          >
            <Settings size={16} />
            Gerenciar slot
          </button>
        )}
      </div>
    </article>
  );
};

export const PlannerSlotCard = React.memo(PlannerSlotCardComponent);
PlannerSlotCard.displayName = 'PlannerSlotCard';

export default PlannerSlotCard;

const MetricBadge = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <span className="inline-flex items-center gap-2 rounded-lg bg-[#F8F7FB] px-3 py-2 text-xs font-semibold text-[#6E1F93] shadow-inner">
    {icon}
    <span className="flex flex-col leading-tight">
      <span>{value}</span>
      <span className="text-[10px] font-medium text-[#6E1F93]/70">{label}</span>
    </span>
  </span>
);
