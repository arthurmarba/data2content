import React from 'react';
import { AnswerEvidence } from './types';
import { track } from '@/lib/track';

type EvidencePanelProps = {
  evidence: AnswerEvidence;
  onRelax?: () => void;
  onImproveBase?: () => void;
};

const formatNumber = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value >= 1000) return value.toLocaleString('pt-BR');
  return value.toString();
};

const deltaText = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}% vs mediana`;
};

const selectIntentMetrics = (intent: string) => {
  if (intent === 'top_reach') {
    return ['reach', 'shares', 'engagement_rate_on_reach', 'saves'] as const;
  }
  if (intent === 'top_saves') {
    return ['saves', 'shares', 'reach'] as const;
  }
  return ['total_interactions', 'engagement_rate_on_reach', 'saves', 'shares', 'comments', 'reach'] as const;
};

const getPrimaryDelta = (intent: string, post: AnswerEvidence['topPosts'][number]) => {
  if (intent === 'top_reach') return post.vsBaseline?.reachPct ?? post.vsBaseline?.interactionsPct ?? null;
  if (intent === 'top_saves') return post.vsBaseline?.savesPct ?? post.vsBaseline?.interactionsPct ?? null;
  return post.vsBaseline?.interactionsPct ?? post.vsBaseline?.erPct ?? null;
};

const isSafeUrl = (url?: string | null) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export function AnswerEvidencePanel({ evidence, onRelax, onImproveBase }: EvidencePanelProps) {
  const [expanded, setExpanded] = React.useState(false);
  const hasPosts = Array.isArray(evidence.topPosts) && evidence.topPosts.length > 0;

  const summaryParts: string[] = [];
  const intentLabel = (() => {
    if (evidence.intent === 'top_reach') return 'Top alcance';
    if (evidence.intent === 'top_saves') return 'Top salvamentos';
    if (evidence.intent?.includes('performance')) return 'Top engajamento';
    return evidence.intent || 'Critério aplicado';
  })();
  summaryParts.push(intentLabel);
  if (evidence.thresholds.formatLocked) summaryParts.push(`${evidence.thresholds.formatLocked} (travado)`);
  if (evidence.baselines?.windowDays) summaryParts.push(`${evidence.baselines.windowDays}d`);
  if (typeof evidence.thresholds.minAbs === 'number') summaryParts.push(`≥${evidence.thresholds.minAbs} interações`);
  if (typeof evidence.thresholds.minRel === 'number') summaryParts.push(`P50*1.25=${evidence.thresholds.minRel}`);
  if (evidence.thresholds.metricsRequired?.length) summaryParts.push(`Métricas: ${evidence.thresholds.metricsRequired.join(', ')}`);

  const badges: Array<{ label: string; tone: 'primary' | 'muted' | 'warn' }> = [];
  if (evidence.thresholds.formatLocked) badges.push({ label: 'Formato travado', tone: 'primary' });
  if (evidence.filtersApplied?.tagsLocked) badges.push({ label: 'Tags/Nicho priorizados', tone: 'muted' });
  const relaxStep = evidence.relaxApplied?.[0];
  if (relaxStep) badges.push({ label: `Critério relaxado: ${relaxStep.step}`, tone: 'warn' });

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    track('chat_evidence_toggle', {
      intent: evidence.intent || null,
      expanded: next,
    });
  };

  const renderEmpty = () => {
    const thresholdLine = summaryParts.join(' • ') || 'Critério aplicado';
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-white/80 px-3 py-3 text-sm text-gray-700 shadow-sm" data-testid="chat-evidence-panel">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-800">Evidências</div>
            <div className="text-xs text-gray-600">{thresholdLine}</div>
          </div>
          {badges.map((b) => (
            <span key={b.label} className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${b.tone === 'warn'
              ? 'bg-amber-50 text-amber-700'
              : b.tone === 'primary'
                ? 'bg-brand-primary/10 text-brand-primary'
                : 'bg-gray-100 text-gray-600'
              }`}>
              {b.label}
            </span>
          ))}
        </div>
        <p className="mt-2">Não encontrei exemplos acima do critério.</p>
        <p className="text-gray-600">Posso relaxar ou você pode postar mais conteúdos para calibrar o baseline.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRelax}
            className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-brand-primary hover:border-brand-primary/50"
          >
            Relaxar critério
          </button>
          <button
            type="button"
            onClick={onImproveBase}
            className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-gray-300"
          >
            Como melhorar minha base?
          </button>
        </div>
      </div>
    );
  };

    if (!hasPosts) return renderEmpty();

  const metricsOrder = selectIntentMetrics(evidence.intent || 'top_performance_inspirations');

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white/80 px-3 py-3 shadow-sm" data-testid="chat-evidence-panel">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-800">Evidências</span>
          <span className="text-xs text-gray-600">{summaryParts.join(' • ')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {badges.map((b) => (
            <span key={b.label} className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${b.tone === 'warn'
              ? 'bg-amber-50 text-amber-700'
              : b.tone === 'primary'
                ? 'bg-brand-primary/10 text-brand-primary'
                : 'bg-gray-100 text-gray-600'
              }`}>
              {b.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center text-xs font-semibold text-brand-primary hover:underline"
          onClick={handleToggle}
        >
          {expanded ? 'Recolher' : 'Ver evidências'}
        </button>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-3">
          {evidence.topPosts.slice(0, 8).map((post, idx) => {
            const metricValues = metricsOrder.map((m) => {
              if (m === 'engagement_rate_on_reach') {
                const er = post.stats.engagement_rate_on_reach ?? post.stats.er_by_reach;
                return er !== undefined && er !== null ? `${(er * 100).toFixed(1)}% ER` : '—';
              }
              return formatNumber((post.stats as any)[m]);
            });
            const delta = deltaText(getPrimaryDelta(evidence.intent, post));
            const tags = [];
            if (post.format) tags.push(Array.isArray(post.format) ? post.format[0] : post.format);
            if (post.tags && post.tags.length) tags.push(post.tags[0]);

            return (
              <div key={post.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.04)]" data-testid="chat-evidence-post">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-500">
                  {post.thumbUrl ? (
                    <img src={post.thumbUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold">{idx + 1}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-800">{post.title || `Post ${idx + 1}`}</span>
                      {post.captionSnippet ? (
                        <span className="text-xs text-gray-600">{post.captionSnippet}</span>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tags.map((t) => (
                          <span key={t} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {delta ? <span className="text-xs font-semibold text-emerald-600">{delta}</span> : null}
                      {isSafeUrl(post.permalink) ? (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="chat-evidence-link"
                          className="text-[11px] font-semibold text-brand-primary hover:underline"
                          onClick={() => {
                            track('chat_evidence_link_click', {
                              intent: evidence.intent || null,
                              post_id: post.id,
                              rank_index: idx,
                            });
                          }}
                        >
                          Ver post
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                    {metricsOrder.map((metricKey, i) => (
                      <span key={`${post.id}-${metricKey}`} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1">
                        {metricKey === 'engagement_rate_on_reach' ? 'ER' : metricKey.replace(/_/g, ' ')}: {metricValues[i]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
