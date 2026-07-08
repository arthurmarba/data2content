/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowUpRight, ChevronDown, Copy } from 'lucide-react';

import { useToast } from '@/app/components/ui/ToastA11yProvider';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { redirectToGoogleConsentLogin } from '@/lib/auth/googleLogin';
import { track } from '@/lib/track';
import { openPaywallModal } from '@/utils/paywallModal';
import type { PaywallContext } from '@/types/paywall';
import type {
  ProposalAnalysisApiResponse,
  ProposalAnalysisStoredSnapshot,
  ProposalAnalysisV2,
  ProposalPricingConsistency,
  ProposalPricingSource,
  ProposalSuggestionType,
} from '@/types/proposals';

import CampaignDetailView from './components/CampaignDetailView';
import type {
  AnalysisViewMode,
  CampaignLinkEntityType,
  CampaignLinkItem,
  CampaignLinkScriptApprovalStatus,
  CampaignsStep,
  LinkablePubliItem,
  LinkableScriptItem,
  ProposalDetail,
  ProposalListItem,
  ProposalStatus,
  ReplyIntent,
  InboxTab,
} from './components/types';

const ANALYSIS_TEXT_REWRITES: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /target de negocia[cç][aã]o estimado em/gi,
    replacement: 'O valor recomendado para esta proposta fica em',
  },
  { pattern: /target estimado/gi, replacement: 'valor recomendado' },
  { pattern: /\btarget\b/gi, replacement: 'valor recomendado' },
  { pattern: /\bgap\b/gi, replacement: 'diferenca' },
  {
    pattern: /taxa hist[oó]rica de fechamento:\s*0(?:[.,]\d+)?%\.?/gi,
    replacement: 'Você ainda não fechou propostas parecidas por aqui.',
  },
  {
    pattern: /taxa hist[oó]rica de fechamento:\s*([0-9]+(?:[.,]\d+)?)%\.?/gi,
    replacement: 'No seu histórico, cerca de $1% das propostas parecidas viraram parceria.',
  },
  { pattern: /primeiro retorno/gi, replacement: 'primeira mensagem' },
  { pattern: /aceite/gi, replacement: 'aceitação' },
  { pattern: /extra de alto valor percebido/gi, replacement: 'extra simples que agrega valor' },
  { pattern: /propostas similares/gi, replacement: 'propostas parecidas' },
  { pattern: /comparação histórica/gi, replacement: 'histórico' },
];

const INTENT_FROM_VERDICT: Record<ProposalSuggestionType, ReplyIntent> = {
  aceitar: 'accept',
  ajustar: 'adjust_value',
  aceitar_com_extra: 'accept',
  ajustar_escopo: 'adjust_scope',
  coletar_orcamento: 'collect_budget',
};
const PROPOSAL_COPY_FEEDBACK_MS = 20_000;
const LAST_VIEWED_CAMPAIGNS_AT_KEY = 'd2c_last_viewed_campaigns_at';

const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
    maximumFractionDigits: 2,
  });

function simplifyAnalysisText(value: string): string {
  let next = value;
  for (const rule of ANALYSIS_TEXT_REWRITES) {
    next = next.replace(rule.pattern, rule.replacement);
  }
  return next.replace(/\s{2,}/g, ' ').trim();
}

function normalizeAnalysisMessageForDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  return simplifyAnalysisText(value);
}

function normalizeAnalysisV2ForDisplay(value: ProposalAnalysisV2 | null | undefined): ProposalAnalysisV2 | null {
  if (!value) return null;
  return {
    ...value,
    rationale: value.rationale.map(simplifyAnalysisText),
    playbook: value.playbook.map(simplifyAnalysisText),
    cautions: value.cautions.map(simplifyAnalysisText),
  };
}

type AnalysisPricingMeta = {
  pricingConsistency: ProposalPricingConsistency | null;
  pricingSource: ProposalPricingSource | null;
  limitations: string[];
};

function normalizeAnalysisPricingMeta(value: {
  pricingConsistency?: ProposalPricingConsistency | null;
  pricingSource?: ProposalPricingSource | null;
  limitations?: string[] | null;
} | null | undefined): AnalysisPricingMeta {
  const consistency =
    value?.pricingConsistency === 'alta' ||
      value?.pricingConsistency === 'media' ||
      value?.pricingConsistency === 'baixa'
      ? value.pricingConsistency
      : null;
  const source =
    value?.pricingSource === 'calculator_core_v1' || value?.pricingSource === 'historical_only'
      ? value.pricingSource
      : null;
  const limitations = Array.isArray(value?.limitations)
    ? value.limitations.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    pricingConsistency: consistency,
    pricingSource: source,
    limitations,
  };
}

function normalizeEmailParagraphs(value: string): string {
  const lines = value.replace(/\r\n/g, '\n').split('\n').map((line) => line.trimEnd());
  const normalized: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      if (normalized.length === 0 || normalized[normalized.length - 1] === '') continue;
      normalized.push('');
      continue;
    }
    normalized.push(line.trim());
  }

  while (normalized.length > 0 && normalized[normalized.length - 1] === '') {
    normalized.pop();
  }

  return normalized.join('\n');
}

function extractSignatureBlock(draft: string): string | null {
  const normalized = draft.replace(/\r\n/g, '\n');
  const markerIndex = normalized.search(/(^|\n)\s*[—-]\s+/);
  if (markerIndex === -1) return null;
  return normalized.slice(markerIndex).trim();
}

function ensureMediaKitParagraph(draft: string, mediaKitUrl: string | null): string {
  const normalized = normalizeEmailParagraphs(draft);
  if (!mediaKitUrl) return normalized;

  const hasUrl = normalized.toLowerCase().includes(mediaKitUrl.toLowerCase());
  const hasRealtimeMention = /m[eé]tricas?\s+em\s+tempo\s+real/i.test(normalized);

  if (hasUrl && hasRealtimeMention) {
    return normalized;
  }

  const mediaKitParagraph = hasUrl
    ? 'No meu mídia kit público, vocês conseguem acompanhar minhas métricas em tempo real.'
    : `Também deixo meu mídia kit público aqui: ${mediaKitUrl}. Por ele, vocês conseguem acompanhar minhas métricas em tempo real.`;

  return normalizeEmailParagraphs(`${normalized}\n\n${mediaKitParagraph}`);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoneyValue(value: number | null, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return currencyFormatter(currency || 'BRL').format(value);
}

function getDaysSince(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
}

function getProposalMomentLabel(proposal: ProposalListItem): string {
  if (proposal.status === 'respondido') {
    return `Últ. resposta · ${formatDate(proposal.lastResponseAt)}`;
  }
  if (proposal.status === 'aceito') {
    return `Fechada · ${formatDate(proposal.lastResponseAt || proposal.createdAt)}`;
  }
  if (proposal.status === 'rejeitado') {
    return `Encerrada · ${formatDate(proposal.lastResponseAt || proposal.createdAt)}`;
  }
  return `Recebida · ${formatDate(proposal.createdAt)}`;
}

function getProposalUrgencyMeta(proposal: ProposalListItem): { label: string; textClassName: string; dotClassName: string } {
  if (proposal.status === 'aceito') {
    return { label: 'Fechada', textClassName: 'text-zinc-500', dotClassName: 'bg-zinc-400' };
  }

  if (proposal.status === 'rejeitado') {
    return { label: 'Encerrada', textClassName: 'text-zinc-500', dotClassName: 'bg-zinc-400' };
  }

  if (proposal.budgetIntent === 'requested' && proposal.budget === null) {
    return { label: 'Sem valor', textClassName: 'text-zinc-500', dotClassName: 'bg-zinc-400' };
  }

  const referenceDate = proposal.status === 'respondido' ? proposal.lastResponseAt || proposal.createdAt : proposal.createdAt;
  const elapsedDays = getDaysSince(referenceDate);

  if (proposal.status === 'respondido') {
    if (elapsedDays !== null && elapsedDays >= 5) {
      return { label: 'Retomar', textClassName: 'text-amber-700', dotClassName: 'bg-amber-500' };
    }
    if (elapsedDays !== null && elapsedDays >= 2) {
      return { label: 'Acompanhar', textClassName: 'text-zinc-500', dotClassName: 'bg-zinc-400' };
    }
    return { label: 'Em dia', textClassName: 'text-zinc-500', dotClassName: 'bg-zinc-400' };
  }

  if (elapsedDays !== null && elapsedDays >= 3) {
    return { label: 'Alta', textClassName: 'text-rose-600', dotClassName: 'bg-rose-500' };
  }
  if (elapsedDays !== null && elapsedDays >= 1) {
    return { label: 'Média', textClassName: 'text-zinc-500', dotClassName: 'bg-zinc-400' };
  }

  return { label: 'Nova', textClassName: 'text-zinc-500', dotClassName: 'bg-zinc-400' };
}

function parseBudgetInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const sanitized = trimmed.replace(/[^\d.,-]/g, '');
  if (!sanitized) return undefined;

  const isNegative = sanitized.startsWith('-');
  const unsigned = isNegative ? sanitized.slice(1) : sanitized;
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  let decimalSeparatorIndex = -1;
  if (lastComma !== -1 || lastDot !== -1) {
    decimalSeparatorIndex =
      lastComma !== -1 && lastDot !== -1 ? (lastComma > lastDot ? lastComma : lastDot) : Math.max(lastComma, lastDot);
  }

  let numeric = '';
  if (decimalSeparatorIndex !== -1) {
    const integerPart = unsigned.slice(0, decimalSeparatorIndex).replace(/[.,]/g, '');
    const fractionalPart = unsigned.slice(decimalSeparatorIndex + 1).replace(/[.,]/g, '');
    numeric = `${integerPart}.${fractionalPart}`;
  } else {
    numeric = unsigned.replace(/[.,]/g, '');
  }

  if (!numeric) return undefined;
  const parsed = Number.parseFloat((isNegative ? '-' : '') + numeric);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeLinkableScripts(payload: any): LinkableScriptItem[] {
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  return rawItems
    .map((item: any) => ({
      id: String(item?.id ?? ''),
      title: typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : 'Roteiro sem título',
      source: item?.source === 'ai' || item?.source === 'planner' ? item.source : 'manual',
      updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : null,
    }))
    .filter((item: LinkableScriptItem) => Boolean(item.id));
}

function normalizeLinkablePublis(payload: any): LinkablePubliItem[] {
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  return rawItems
    .map((item: any) => ({
      id: String(item?.id ?? ''),
      description: typeof item?.description === 'string' ? item.description : '',
      theme: typeof item?.theme === 'string' && item.theme.trim() ? item.theme.trim() : null,
      postDate: typeof item?.postDate === 'string' ? item.postDate : null,
    }))
    .filter((item: LinkablePubliItem) => Boolean(item.id));
}

function buildIntentDraft(input: {
  intent: ReplyIntent;
  proposal: ProposalDetail;
  analysisV2: ProposalAnalysisV2 | null;
  mediaKitUrl: string | null;
  existingDraft: string;
}): string {
  const { intent, proposal, analysisV2, mediaKitUrl, existingDraft } = input;
  const greeting = `Oi, pessoal da ${proposal.brandName}! Tudo bem?`;
  const context = proposal.campaignTitle
    ? `Recebi a proposta “${proposal.campaignTitle}” e gostei da direção da campanha.`
    : 'Recebi a proposta e gostei da direção da campanha.';

  const pricing = analysisV2?.pricing;
  const currency = proposal.currency || analysisV2?.pricing.currency || 'BRL';
  const offered = formatMoneyValue(pricing?.offered ?? proposal.budget ?? null, currency);
  const target = formatMoneyValue(pricing?.target ?? null, currency);
  const anchor = formatMoneyValue(pricing?.anchor ?? null, currency);

  let decision = '';
  let nextStep = 'Se fizer sentido para vocês, seguimos com os próximos passos e alinhamos datas de entrega.';

  switch (intent) {
    case 'accept':
      decision =
        proposal.budget !== null || pricing?.offered !== null
          ? `Podemos seguir com o valor de ${offered} e avançar com este escopo.`
          : 'Podemos seguir com a proposta e avançar com este escopo.';
      nextStep =
        'Se aprovarem, já respondo com cronograma e entregáveis para começarmos com tudo alinhado.';
      break;
    case 'adjust_value':
      decision =
        pricing?.target !== null && pricing?.target !== undefined
          ? `Para este escopo completo, o valor recomendado fica em ${target}. Posso iniciar em ${anchor} para fecharmos com qualidade.`
          : 'Para este escopo completo, preciso de um ajuste de valor para manter a qualidade da entrega.';
      nextStep =
        'Se esse ajuste fizer sentido para vocês, envio a confirmação com prazo e plano de entrega ainda hoje.';
      break;
    case 'adjust_scope':
      decision =
        pricing?.target !== null && pricing?.target !== undefined
          ? `No escopo completo, o valor recomendado fica em ${target}. Se preferirem manter o orçamento atual, posso montar uma versão mais enxuta do escopo.`
          : 'Para manter o orçamento atual, posso ajustar o escopo e focar nas entregas com mais impacto.';
      nextStep = 'Se quiserem, já envio as duas opções de pacote para facilitar a decisão.';
      break;
    case 'collect_budget':
      decision =
        'Para te passar um valor justo, vocês podem compartilhar a faixa de orçamento e o prazo esperado da campanha?';
      nextStep =
        'Com essas informações, devolvo uma proposta objetiva com escopo e cronograma.';
      break;
    default:
      decision = 'Podemos avançar com a proposta e alinhar os detalhes de execução.';
      break;
  }

  const mediaKitParagraph = mediaKitUrl
    ? `Também deixo meu mídia kit público aqui: ${mediaKitUrl}. Por ele, vocês conseguem acompanhar minhas métricas em tempo real.`
    : null;

  const fallbackSignature = '— Creator\nvia Data2Content';
  const signature = extractSignatureBlock(existingDraft) ?? fallbackSignature;

  return normalizeEmailParagraphs(
    [greeting, context, decision, mediaKitParagraph, nextStep, signature].filter(Boolean).join('\n\n')
  );
}

function statusToTab(status: ProposalStatus): InboxTab {
  if (status === 'aceito') return 'won';
  if (status === 'rejeitado') return 'lost';
  if (status === 'respondido') return 'negotiation';
  return 'incoming';
}

function summaryFromSnapshot(snapshot: ProposalAnalysisStoredSnapshot | null | undefined): {
  analysisMessage: string | null;
  analysisV2: ProposalAnalysisV2 | null;
  analysisPricingMeta: AnalysisPricingMeta;
  replyDraft: string;
  suggestionType: ProposalSuggestionType | null;
} {
  if (!snapshot) {
    return {
      analysisMessage: null,
      analysisV2: null,
      analysisPricingMeta: {
        pricingConsistency: null,
        pricingSource: null,
        limitations: [],
      },
      replyDraft: '',
      suggestionType: null,
    };
  }

  return {
    analysisMessage: normalizeAnalysisMessageForDisplay(snapshot.analysis),
    analysisV2: normalizeAnalysisV2ForDisplay(snapshot.analysisV2),
    analysisPricingMeta: normalizeAnalysisPricingMeta({
      pricingConsistency: snapshot.pricingConsistency,
      pricingSource: snapshot.pricingSource,
      limitations: snapshot.limitations,
    }),
    replyDraft: snapshot.replyDraft ?? '',
    suggestionType: snapshot.suggestionType,
  };
}

const PIPELINE_GROUPS: Array<{
  key: InboxTab;
  label: string;
  emptyLabel: string;
  statuses: ProposalStatus[];
  dotClassName: string;
  panelClassName: string;
  contentClassName: string;
  itemClassName: string;
  pillClassName: string;
  totalClassName: string;
}> = [
  {
    key: 'incoming',
    label: 'Novas Propostas',
    emptyLabel: 'Nenhuma proposta recebida no momento.',
    statuses: ['novo', 'visto'],
    dotClassName: 'bg-rose-500',
    panelClassName: 'border-slate-200',
    contentClassName: 'bg-blue-50/20',
    itemClassName: 'border-blue-200/80',
    pillClassName: 'bg-zinc-100 text-zinc-500',
    totalClassName: 'text-zinc-900',
  },
  {
    key: 'negotiation',
    label: 'Em Negociação',
    emptyLabel: 'Nenhuma negociação aberta agora.',
    statuses: ['respondido'],
    dotClassName: 'bg-amber-400',
    panelClassName: 'border-slate-200',
    contentClassName: 'bg-amber-50/18',
    itemClassName: 'border-amber-200/80',
    pillClassName: 'bg-zinc-100 text-zinc-500',
    totalClassName: 'text-zinc-900',
  },
  {
    key: 'won',
    label: 'Fechadas (Mês)',
    emptyLabel: 'Nenhuma campanha fechada ainda.',
    statuses: ['aceito'],
    dotClassName: 'bg-emerald-500',
    panelClassName: 'border-slate-200',
    contentClassName: 'bg-emerald-50/18',
    itemClassName: 'border-emerald-200/80',
    pillClassName: 'bg-zinc-100 text-zinc-500',
    totalClassName: 'text-zinc-900',
  },
  {
    key: 'lost',
    label: 'Perdidas',
    emptyLabel: 'Nenhuma campanha perdida registrada.',
    statuses: ['rejeitado'],
    dotClassName: 'bg-zinc-300',
    panelClassName: 'border-slate-200',
    contentClassName: 'bg-zinc-50/22',
    itemClassName: 'border-zinc-200/80',
    pillClassName: 'bg-zinc-100 text-zinc-500',
    totalClassName: 'text-zinc-900',
  },
];

const COMPACT_PIPELINE_LIST_VISUALS: Record<
  InboxTab,
  {
    headerChipClassName: string;
    headerDotClassName: string;
    rankBadgeClassName: string;
    labelHoverClassName: string;
    summaryClassName: string;
    arrowClassName: string;
  }
> = {
  incoming: {
    headerChipClassName: 'bg-rose-50 text-rose-500 ring-1 ring-rose-100/90',
    headerDotClassName: 'bg-rose-400',
    rankBadgeClassName: 'bg-rose-50 text-rose-500',
    labelHoverClassName: 'group-hover:text-rose-500 group-focus-visible:text-rose-500',
    summaryClassName: 'text-rose-500',
    arrowClassName: 'text-zinc-300 group-hover:text-rose-500 group-focus-visible:text-rose-500',
  },
  negotiation: {
    headerChipClassName: 'bg-amber-50 text-amber-500 ring-1 ring-amber-100/90',
    headerDotClassName: 'bg-amber-400',
    rankBadgeClassName: 'bg-amber-50 text-amber-600',
    labelHoverClassName: 'group-hover:text-amber-600 group-focus-visible:text-amber-600',
    summaryClassName: 'text-amber-600',
    arrowClassName: 'text-zinc-300 group-hover:text-amber-500 group-focus-visible:text-amber-500',
  },
  won: {
    headerChipClassName: 'bg-emerald-50 text-emerald-500 ring-1 ring-emerald-100/90',
    headerDotClassName: 'bg-emerald-400',
    rankBadgeClassName: 'bg-emerald-50 text-emerald-600',
    labelHoverClassName: 'group-hover:text-emerald-600 group-focus-visible:text-emerald-600',
    summaryClassName: 'text-emerald-600',
    arrowClassName: 'text-zinc-300 group-hover:text-emerald-500 group-focus-visible:text-emerald-500',
  },
  lost: {
    headerChipClassName: 'bg-zinc-50 text-zinc-500 ring-1 ring-zinc-100/90',
    headerDotClassName: 'bg-zinc-400',
    rankBadgeClassName: 'bg-zinc-50 text-zinc-500',
    labelHoverClassName: 'group-hover:text-zinc-600 group-focus-visible:text-zinc-600',
    summaryClassName: 'text-zinc-400',
    arrowClassName: 'text-zinc-300 group-hover:text-zinc-500 group-focus-visible:text-zinc-500',
  },
};

const COMPACT_EMPTY_PREVIEW_HELPER_TEXT: Record<InboxTab, string> = {
  incoming: 'As próximas propostas vão aparecer aqui.',
  negotiation: 'Negociações ativas ficam organizadas nesta etapa.',
  won: 'Campanhas fechadas entram aqui ao final do funil.',
  lost: 'Campanhas perdidas ficam registradas aqui.',
};

export default function ProposalsClient({ compactView = false }: { compactView?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();
  const billingStatus = useBillingStatus();
  const [, setLastViewedCampaignsAt] = useLocalStorage<string>(LAST_VIEWED_CAMPAIGNS_AT_KEY, '');
  const requestedProposalId = useMemo(() => {
    const value = searchParams?.get('proposalId');
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }, [searchParams]);

  const [isLoading, setIsLoading] = useState(true);
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<ProposalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState<CampaignsStep>('inbox');
  const [activeTab, setActiveTab] = useState<InboxTab>('incoming');
  const [expandedSections, setExpandedSections] = useState<Record<InboxTab, boolean>>({
    incoming: true,
    negotiation: false,
    won: false,
    lost: false,
  });
  const [analysisViewMode, setAnalysisViewMode] = useState<AnalysisViewMode>('summary');
  const [replyIntent, setReplyIntent] = useState<ReplyIntent>('accept');

  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisV2, setAnalysisV2] = useState<ProposalAnalysisV2 | null>(null);
  const [analysisPricingMeta, setAnalysisPricingMeta] = useState<AnalysisPricingMeta>({
    pricingConsistency: null,
    pricingSource: null,
    limitations: [],
  });
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyRegenerating, setReplyRegenerating] = useState(false);
  const [creatorProposedBudgetInput, setCreatorProposedBudgetInput] = useState('');
  const [proposedBudgetSaving, setProposedBudgetSaving] = useState(false);
  const [campaignLinks, setCampaignLinks] = useState<CampaignLinkItem[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [linkableScripts, setLinkableScripts] = useState<LinkableScriptItem[]>([]);
  const [linkablePublis, setLinkablePublis] = useState<LinkablePubliItem[]>([]);
  const [linkableLoading, setLinkableLoading] = useState(false);
  const [linkableError, setLinkableError] = useState<string | null>(null);
  const [linkMutating, setLinkMutating] = useState(false);
  const [activeLinkMutationId, setActiveLinkMutationId] = useState<string | null>(null);

  const [mediaKitUrl, setMediaKitUrl] = useState<string | null>(null);
  const [isCopyingMediaKitLink, setIsCopyingMediaKitLink] = useState(false);
  const [isCopyingProposalFormLink, setIsCopyingProposalFormLink] = useState(false);
  const [proposalCopyFeedbackVisible, setProposalCopyFeedbackVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const notifiedProposalsRef = useRef<Set<string>>(new Set());
  const lockViewedRef = useRef(false);
  const campaignLinksCacheRef = useRef<Map<string, CampaignLinkItem[]>>(new Map());
  const linkableAssetsCacheRef = useRef<{
    isLoaded: boolean;
    scripts: LinkableScriptItem[];
    publis: LinkablePubliItem[];
  }>({
    isLoaded: false,
    scripts: [],
    publis: [],
  });

  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const proposalCopyFeedbackTimerRef = useRef<number | null>(null);

  const hasProAccess = Boolean(billingStatus.hasPremiumAccess);
  const isBillingLoading = Boolean(billingStatus.isLoading);
  const canInteract = hasProAccess && !isBillingLoading;

  const buildReturnTo = useCallback(
    (proposalId?: string | null) => {
      const id = proposalId ?? selectedProposal?.id ?? null;
      return id ? `/dashboard/proposals?proposalId=${encodeURIComponent(id)}` : '/dashboard/proposals';
    },
    [selectedProposal]
  );

  const resolvePublicMediaKitUrl = useCallback(() => {
    if (mediaKitUrl) return mediaKitUrl;
    if (!selectedProposal?.mediaKitSlug) return null;
    if (typeof window === 'undefined') return null;
    return `${window.location.origin}/mediakit/${selectedProposal.mediaKitSlug}`;
  }, [mediaKitUrl, selectedProposal?.mediaKitSlug]);

  const showUpgradeToast = useCallback(() => {
    toast({
      variant: 'info',
      title: 'Recurso exclusivo do Plano Pro',
      description: 'A IA de negociação faz parte do Plano Pro. A resposta manual continua liberada.',
    });
  }, [toast]);

  const openPaywall = useCallback(
    (source: string, context: PaywallContext) => {
      const normalizedPlan = billingStatus.normalizedStatus ?? billingStatus.planStatus ?? null;
      const telemetryContext =
        context === 'default' || context === 'narrative_map' || context === 'onboarding'
          ? 'other'
          : context === 'whatsapp'
            ? 'whatsapp_ai'
            : context as Exclude<typeof context, 'default' | 'narrative_map' | 'onboarding' | 'whatsapp'>;
      track('pro_feature_upgrade_clicked', {
        feature: 'proposals_reply',
        source,
      });
      track('paywall_viewed', {
        creator_id: null,
        context: telemetryContext,
        plan: normalizedPlan,
      });
      openPaywallModal({
        context,
        source,
        returnTo: buildReturnTo(selectedProposal?.id),
        proposalId: selectedProposal?.id ?? null,
      });
    },
    [billingStatus.normalizedStatus, billingStatus.planStatus, buildReturnTo, selectedProposal]
  );

  const showProposalCopyFeedback = useCallback(() => {
    setProposalCopyFeedbackVisible(true);
    if (typeof window === 'undefined') return;
    if (proposalCopyFeedbackTimerRef.current) {
      window.clearTimeout(proposalCopyFeedbackTimerRef.current);
    }
    proposalCopyFeedbackTimerRef.current = window.setTimeout(() => {
      setProposalCopyFeedbackVisible(false);
      proposalCopyFeedbackTimerRef.current = null;
    }, PROPOSAL_COPY_FEEDBACK_MS);
  }, []);

  useEffect(
    () => () => {
      if (proposalCopyFeedbackTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(proposalCopyFeedbackTimerRef.current);
      }
    },
    []
  );

  const copyTextWithFallback = useCallback(async (value: string): Promise<boolean> => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText &&
        typeof window !== 'undefined' &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // fallback below
    }

    try {
      if (typeof document === 'undefined') return false;
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return Boolean(success);
    } catch {
      return false;
    }
  }, []);

  const getOrCreateMediaKitUrl = useCallback(async (): Promise<string | null> => {
    const getLink = async (method: 'GET' | 'POST') => {
      const response = await fetch('/api/users/media-kit-token', {
        method,
        cache: 'no-store',
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) return null;
      return payload?.url ?? payload?.publicUrl ?? null;
    };

    let link = resolvePublicMediaKitUrl();
    if (!link) {
      link = await getLink('GET');
    }
    if (!link) {
      link = await getLink('POST');
    }
    if (link) {
      setMediaKitUrl(link);
    }
    return link;
  }, [resolvePublicMediaKitUrl]);

  const buildProposalFormUrl = useCallback((mediaKitLink: string) => {
    try {
      const url = new URL(
        mediaKitLink,
        typeof window !== 'undefined' ? window.location.origin : 'https://app.data2content.ai'
      );
      url.searchParams.set('proposal', 'only');
      return url.toString();
    } catch {
      return mediaKitLink.includes('?')
        ? `${mediaKitLink}&proposal=only`
        : `${mediaKitLink}?proposal=only`;
    }
  }, []);

  const markProposalFormLinkCopied = useCallback(async () => {
    try {
      await fetch('/api/dashboard/proposals/proposal-link-copied', {
        method: 'POST',
      });
    } catch {
      // falha de marcação não deve bloquear fluxo de cópia
    }
  }, []);

  const loadProposals = useCallback(async () => {
    if (sessionStatus === 'unauthenticated') {
      setProposals([]);
      setSelectedId(null);
      setSelectedProposal(null);
      setAnalysisMessage(null);
      setAnalysisV2(null);
      setAnalysisPricingMeta({ pricingConsistency: null, pricingSource: null, limitations: [] });
      setReplyDraft('');
      setCreatorProposedBudgetInput('');
      setCampaignLinks([]);
      setLinksError(null);
      setLinkableScripts([]);
      setLinkablePublis([]);
      setLinkableError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/proposals', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Não foi possível carregar as propostas.');
      }
      const payload = await response.json();
      const items = (payload?.items ?? []) as ProposalListItem[];

      setProposals(items);
      if (items.length === 0) {
        setSelectedId(null);
        setSelectedProposal(null);
        setAnalysisMessage(null);
        setAnalysisV2(null);
        setAnalysisPricingMeta({ pricingConsistency: null, pricingSource: null, limitations: [] });
        setReplyDraft('');
        setCreatorProposedBudgetInput('');
        setCampaignLinks([]);
        setLinksError(null);
        setLinkableScripts([]);
        setLinkablePublis([]);
        setLinkableError(null);
        return;
      }

      setSelectedId((prev) => {
        if (requestedProposalId && items.some((item) => item.id === requestedProposalId)) {
          return requestedProposalId;
        }
        if (prev && items.some((item) => item.id === prev)) {
          return prev;
        }
        return items[0]?.id ?? null;
      });
    } catch (error: any) {
      toast({ variant: 'error', title: error?.message || 'Erro ao carregar propostas.' });
      setProposals([]);
    } finally {
      setIsLoading(false);
    }
  }, [requestedProposalId, sessionStatus, toast]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    loadProposals();
  }, [loadProposals, sessionStatus]);

  useEffect(() => {
    if (isLoading) return;
    if (!proposals.length) return;
    setLastViewedCampaignsAt(new Date().toISOString());
  }, [isLoading, proposals.length, setLastViewedCampaignsAt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);
    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);
    return () => mediaQuery.removeEventListener('change', updateIsMobile);
  }, []);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      setMediaKitUrl(null);
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedProposal(null);
      setAnalysisMessage(null);
      setAnalysisV2(null);
      setAnalysisPricingMeta({ pricingConsistency: null, pricingSource: null, limitations: [] });
      setReplyDraft('');
      setCreatorProposedBudgetInput('');
      setCampaignLinks([]);
      setLinksError(null);
      setLinkableScripts([]);
      setLinkablePublis([]);
      setLinkableError(null);
      return;
    }

    let cancelled = false;

    async function fetchDetail() {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/proposals/${selectedId}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Não foi possível carregar os detalhes da proposta.');
        }

        const payload = (await response.json()) as ProposalDetail;
        if (cancelled) return;

        setSelectedProposal(payload);
        setActiveTab(statusToTab(payload.status));

        const snapshot = summaryFromSnapshot(payload.latestAnalysis);
        setAnalysisMessage(snapshot.analysisMessage);
        setAnalysisV2(snapshot.analysisV2);
        setAnalysisPricingMeta(snapshot.analysisPricingMeta);
        setReplyDraft(snapshot.replyDraft || payload.lastResponseMessage || '');

        if (snapshot.suggestionType) {
          setReplyIntent(INTENT_FROM_VERDICT[snapshot.suggestionType]);
        }

        setCreatorProposedBudgetInput(
          typeof payload.creatorProposedBudget === 'number'
            ? String(payload.creatorProposedBudget)
            : ''
        );

        if (payload.status === 'novo') {
          await updateProposalStatus(payload.id, 'visto', false);
        }
      } catch (error: any) {
        if (!cancelled) {
          toast({ variant: 'error', title: error?.message || 'Erro ao carregar detalhes da proposta.' });
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId, toast]);

  useEffect(() => {
    if (!hasProAccess && !isBillingLoading) {
      if (!lockViewedRef.current) {
        track('pro_feature_locked_viewed', {
          feature: 'proposals_reply',
        });
        lockViewedRef.current = true;
      }
    } else {
      lockViewedRef.current = false;
    }
  }, [hasProAccess, isBillingLoading]);

  useEffect(() => {
    if (!selectedProposal || hasProAccess || isBillingLoading) return;
    if (notifiedProposalsRef.current.has(selectedProposal.id)) return;

    notifiedProposalsRef.current.add(selectedProposal.id);
    track('proposal_received_free_user', {
      proposalId: selectedProposal.id,
      status: selectedProposal.status,
      budget: selectedProposal.budget ?? null,
      currency: selectedProposal.currency ?? 'BRL',
    });

    fetch(`/api/proposals/${selectedProposal.id}/notify-upgrade`, {
      method: 'POST',
    }).catch(() => {
      /* ignore */
    });
  }, [selectedProposal, hasProAccess, isBillingLoading]);

  useEffect(() => {
    if (!requestedProposalId) return;
    if (selectedProposal?.id !== requestedProposalId) return;
    setCurrentStep('detail');
  }, [requestedProposalId, selectedProposal?.id]);

  const loadCampaignWorkspace = useCallback(async (proposalId: string, options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    const cachedLinks = campaignLinksCacheRef.current.get(proposalId);
    const hasCachedLinkables = linkableAssetsCacheRef.current.isLoaded;

    if (!force && cachedLinks) {
      setCampaignLinks(cachedLinks);
      setLinksError(null);
    }

    if (!force && cachedLinks && hasCachedLinkables) {
      setLinkableScripts(linkableAssetsCacheRef.current.scripts);
      setLinkablePublis(linkableAssetsCacheRef.current.publis);
      setLinkableError(null);
      return;
    }

    try {
      setLinksLoading(true);
      if (!hasCachedLinkables || force) {
        setLinkableLoading(true);
        setLinkableError(null);
      }
      setLinksError(null);

      const response = await fetch(`/api/proposals/${proposalId}/links?includeLinkables=1&limit=30`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível carregar os vínculos da campanha.');
      }

      const items = Array.isArray(payload?.items) ? (payload.items as CampaignLinkItem[]) : [];
      setCampaignLinks(items);
      campaignLinksCacheRef.current.set(proposalId, items);

      const rawScripts = Array.isArray(payload?.linkableScripts) ? payload.linkableScripts : null;
      const rawPublis = Array.isArray(payload?.linkablePublis) ? payload.linkablePublis : null;
      if (rawScripts && rawPublis) {
        const nextScripts = normalizeLinkableScripts({ items: rawScripts });
        const nextPublis = normalizeLinkablePublis({ items: rawPublis });
        setLinkableScripts(nextScripts);
        setLinkablePublis(nextPublis);
        setLinkableError(null);
        linkableAssetsCacheRef.current = {
          isLoaded: true,
          scripts: nextScripts,
          publis: nextPublis,
        };
      } else if (linkableAssetsCacheRef.current.isLoaded) {
        setLinkableScripts(linkableAssetsCacheRef.current.scripts);
        setLinkablePublis(linkableAssetsCacheRef.current.publis);
        setLinkableError(null);
      }
    } catch (error: any) {
      if (!cachedLinks) {
        setCampaignLinks([]);
      }
      setLinksError(error?.message || 'Falha ao carregar vínculos.');

      if (!hasCachedLinkables) {
        setLinkableScripts([]);
        setLinkablePublis([]);
        setLinkableError(error?.message || 'Falha ao carregar ativos vinculáveis.');
      }
    } finally {
      setLinksLoading(false);
      if (!hasCachedLinkables || force) {
        setLinkableLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if ((compactView || isMobile) && currentStep === 'inbox') return;
    if (!selectedProposal?.id) return;

    void loadCampaignWorkspace(selectedProposal.id);
  }, [compactView, currentStep, isMobile, loadCampaignWorkspace, selectedProposal?.id]);

  const handleLinkEntity = useCallback(
    async (entityType: CampaignLinkEntityType, entityId: string) => {
      if (!selectedProposal) return;

      try {
        setLinkMutating(true);
        setActiveLinkMutationId(entityId);
        const response = await fetch(`/api/proposals/${selectedProposal.id}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType,
            entityId,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Não foi possível vincular item à campanha.');
        }

        const item = payload?.item as CampaignLinkItem | undefined;
        if (item?.id) {
          setCampaignLinks((prev) => {
            const next = [item, ...prev.filter((link) => link.id !== item.id)];
            campaignLinksCacheRef.current.set(selectedProposal.id, next);
            return next;
          });
        } else {
          await loadCampaignWorkspace(selectedProposal.id, { force: true });
        }

        toast({
          variant: 'success',
          title: payload?.created === false ? 'Item já estava vinculado.' : 'Item vinculado à campanha.',
        });
      } catch (error: any) {
        toast({ variant: 'error', title: error?.message || 'Falha ao vincular item.' });
      } finally {
        setLinkMutating(false);
        setActiveLinkMutationId(null);
      }
    },
    [loadCampaignWorkspace, selectedProposal, toast]
  );

  const handleLinkScript = useCallback(
    async (scriptId: string) => {
      await handleLinkEntity('script', scriptId);
    },
    [handleLinkEntity]
  );

  const handleLinkPubli = useCallback(
    async (publiId: string) => {
      await handleLinkEntity('publi', publiId);
    },
    [handleLinkEntity]
  );

  const handleUnlinkEntity = useCallback(
    async (linkId: string) => {
      if (!selectedProposal) return;
      try {
        setLinkMutating(true);
        setActiveLinkMutationId(linkId);
        const response = await fetch(`/api/proposals/${selectedProposal.id}/links/${linkId}`, {
          method: 'DELETE',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Não foi possível remover o vínculo.');
        }

        setCampaignLinks((prev) => {
          const next = prev.filter((item) => item.id !== linkId);
          campaignLinksCacheRef.current.set(selectedProposal.id, next);
          return next;
        });
        toast({ variant: 'success', title: 'Vínculo removido.' });
      } catch (error: any) {
        toast({ variant: 'error', title: error?.message || 'Falha ao remover vínculo.' });
      } finally {
        setLinkMutating(false);
        setActiveLinkMutationId(null);
      }
    },
    [selectedProposal, toast]
  );

  const handleUpdateLinkStatus = useCallback(
    async (linkId: string, status: CampaignLinkScriptApprovalStatus) => {
      if (!selectedProposal) return;
      try {
        setLinkMutating(true);
        setActiveLinkMutationId(linkId);
        const response = await fetch(`/api/proposals/${selectedProposal.id}/links/${linkId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptApprovalStatus: status }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Não foi possível atualizar status do roteiro.');
        }

        const item = payload?.item as CampaignLinkItem | undefined;
        if (item?.id) {
          setCampaignLinks((prev) => {
            const next = prev.map((link) => (link.id === item.id ? item : link));
            campaignLinksCacheRef.current.set(selectedProposal.id, next);
            return next;
          });
        } else {
          await loadCampaignWorkspace(selectedProposal.id, { force: true });
        }
      } catch (error: any) {
        toast({ variant: 'error', title: error?.message || 'Falha ao atualizar status.' });
      } finally {
        setLinkMutating(false);
        setActiveLinkMutationId(null);
      }
    },
    [loadCampaignWorkspace, selectedProposal, toast]
  );

  const updateProposalStatus = useCallback(
    async (id: string, status: ProposalStatus, notify = true) => {
      try {
        const response = await fetch(`/api/proposals/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error('Não foi possível atualizar o status.');
        }

        const updated = (await response.json()) as ProposalDetail;
        setProposals((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: updated.status } : item))
        );
        setSelectedProposal((prev) =>
          prev && prev.id === id ? { ...prev, status: updated.status } : prev
        );
        setActiveTab(statusToTab(updated.status));
        if (notify) {
          toast({ variant: 'success', title: 'Status atualizado com sucesso.' });
        }
      } catch (error: any) {
        toast({ variant: 'error', title: error?.message || 'Erro ao atualizar status.' });
      }
    },
    [toast]
  );

  const requestAnalysis = useCallback(async (): Promise<ProposalAnalysisApiResponse> => {
    if (!selectedProposal) {
      throw new Error('Selecione uma proposta para analisar.');
    }
    const response = await fetch(`/api/proposals/${selectedProposal.id}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error || 'Não foi possível gerar a análise da proposta.';
      const error = new Error(message) as Error & { stage?: string };
      error.stage = typeof body?.errorStage === 'string' ? body.errorStage : 'llm';
      throw error;
    }

    return body as ProposalAnalysisApiResponse;
  }, [selectedProposal]);

  const applyReplyIntent = useCallback(
    (intent: ReplyIntent, incomingDraft?: string) => {
      if (!selectedProposal) return;
      const mediaKitPublicUrl = resolvePublicMediaKitUrl();
      const sourceDraft = incomingDraft ?? replyDraft;
      const nextDraft = buildIntentDraft({
        intent,
        proposal: selectedProposal,
        analysisV2,
        mediaKitUrl: mediaKitPublicUrl,
        existingDraft: sourceDraft,
      });
      setReplyDraft(nextDraft);
      setReplyIntent(intent);
      setCurrentStep('reply');

      window.requestAnimationFrame(() => {
        replyTextareaRef.current?.focus({ preventScroll: false });
      });
    },
    [analysisV2, replyDraft, resolvePublicMediaKitUrl, selectedProposal]
  );

  const handleAnalyze = useCallback(async () => {
    if (!selectedProposal) {
      toast({ variant: 'error', title: 'Selecione uma proposta para continuar.' });
      return;
    }

    if (!canInteract) {
      showUpgradeToast();
      openPaywall('analyze_button', 'ai_analysis');
      return;
    }

    try {
      setAnalysisLoading(true);
      track('ai_analysis_started', {
        creator_id: null,
        proposal_id: selectedProposal.id,
      });

      const payload = await requestAnalysis();
      const normalizedAnalysis = normalizeAnalysisMessageForDisplay(payload?.analysis ?? null);
      const normalizedAnalysisV2 = normalizeAnalysisV2ForDisplay(payload?.analysisV2 ?? null);
      const normalizedPricingMeta = normalizeAnalysisPricingMeta(payload);
      const mediaKitPublicUrl = resolvePublicMediaKitUrl();

      setAnalysisMessage(normalizedAnalysis);
      setAnalysisV2(normalizedAnalysisV2);
      setAnalysisPricingMeta(normalizedPricingMeta);
      setAnalysisViewMode('summary');

      const suggestedIntent = payload?.suggestionType
        ? INTENT_FROM_VERDICT[payload.suggestionType]
        : 'accept';
      setReplyIntent(suggestedIntent);

      const safeDraft = ensureMediaKitParagraph(
        normalizeEmailParagraphs(payload?.replyDraft ?? ''),
        mediaKitPublicUrl
      );
      setReplyDraft(safeDraft);

      track('ai_suggestion_generated', {
        creator_id: null,
        proposal_id: selectedProposal.id,
        suggestion_type: payload?.suggestionType ?? null,
        suggested_value: payload?.suggestedValue ?? null,
        confidence: payload?.analysisV2?.confidence?.score ?? null,
        fallback_used: payload?.meta?.fallbackUsed ?? null,
      });

      toast({ variant: 'success', title: 'Sugestão da IA pronta.' });
      setCurrentStep('reply');

      window.requestAnimationFrame(() => {
        replyTextareaRef.current?.focus({ preventScroll: false });
      });
    } catch (error: any) {
      track('ai_analysis_failed', {
        creator_id: null,
        proposal_id: selectedProposal.id,
        stage: error?.stage ?? 'llm',
      });
      toast({ variant: 'error', title: error?.message || 'Erro ao gerar análise.' });
    } finally {
      setAnalysisLoading(false);
    }
  }, [
    canInteract,
    openPaywall,
    requestAnalysis,
    resolvePublicMediaKitUrl,
    selectedProposal,
    showUpgradeToast,
    toast,
  ]);

  const handleRefreshReply = useCallback(async () => {
    if (!selectedProposal) return;
    if (!canInteract) {
      showUpgradeToast();
      openPaywall('refresh_reply', 'reply_email');
      return;
    }

    try {
      setReplyRegenerating(true);
      track('ai_analysis_started', {
        creator_id: null,
        proposal_id: selectedProposal.id,
      });

      const payload = await requestAnalysis();
      const normalizedAnalysis = normalizeAnalysisMessageForDisplay(payload?.analysis ?? null);
      const normalizedAnalysisV2 = normalizeAnalysisV2ForDisplay(payload?.analysisV2 ?? null);
      const normalizedPricingMeta = normalizeAnalysisPricingMeta(payload);
      const suggestedIntent = payload?.suggestionType
        ? INTENT_FROM_VERDICT[payload.suggestionType]
        : replyIntent;
      const mediaKitPublicUrl = resolvePublicMediaKitUrl();
      const safeDraft = ensureMediaKitParagraph(
        normalizeEmailParagraphs(payload?.replyDraft ?? ''),
        mediaKitPublicUrl
      );

      setAnalysisMessage(normalizedAnalysis);
      setAnalysisV2(normalizedAnalysisV2);
      setAnalysisPricingMeta(normalizedPricingMeta);
      setAnalysisViewMode('summary');
      applyReplyIntent(suggestedIntent, safeDraft);

      track('ai_suggestion_generated', {
        creator_id: null,
        proposal_id: selectedProposal.id,
        suggestion_type: payload?.suggestionType ?? null,
        suggested_value: payload?.suggestedValue ?? null,
        confidence: payload?.analysisV2?.confidence?.score ?? null,
        fallback_used: payload?.meta?.fallbackUsed ?? null,
      });

      toast({ variant: 'success', title: 'Sugestão atualizada com nova abordagem.' });
    } catch (error: any) {
      track('ai_analysis_failed', {
        creator_id: null,
        proposal_id: selectedProposal.id,
        stage: error?.stage ?? 'llm',
      });
      toast({ variant: 'error', title: error?.message || 'Não consegui gerar outra sugestão agora.' });
    } finally {
      setReplyRegenerating(false);
    }
  }, [
    applyReplyIntent,
    canInteract,
    openPaywall,
    replyIntent,
    requestAnalysis,
    resolvePublicMediaKitUrl,
    selectedProposal,
    showUpgradeToast,
    toast,
  ]);

  const handleSaveCreatorProposedBudget = useCallback(async () => {
    if (!selectedProposal) return;

    const parsed = parseBudgetInput(creatorProposedBudgetInput);
    if (parsed === undefined) {
      toast({ variant: 'error', title: 'Valor de orçamento proposto inválido.' });
      return;
    }

    setProposedBudgetSaving(true);
    try {
      const response = await fetch(`/api/proposals/${selectedProposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorProposedBudget: parsed,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível salvar o orçamento proposto.');
      }

      const updated = payload as ProposalDetail;
      setSelectedProposal(updated);
      setCreatorProposedBudgetInput(
        typeof updated.creatorProposedBudget === 'number' ? String(updated.creatorProposedBudget) : ''
      );
      setProposals((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
              ...item,
              creatorProposedBudget: updated.creatorProposedBudget,
              creatorProposedCurrency: updated.creatorProposedCurrency,
              creatorProposedAt: updated.creatorProposedAt,
            }
            : item
        )
      );

      toast({ variant: 'success', title: 'Orçamento proposto salvo.' });
    } catch (error: any) {
      toast({ variant: 'error', title: error?.message || 'Falha ao salvar orçamento proposto.' });
    } finally {
      setProposedBudgetSaving(false);
    }
  }, [creatorProposedBudgetInput, selectedProposal, toast]);

  const handleSendReply = useCallback(async () => {
    if (!selectedProposal) return;

    const mediaKitPublicUrl = resolvePublicMediaKitUrl();
    const normalizedDraft = ensureMediaKitParagraph(normalizeEmailParagraphs(replyDraft.trim()), mediaKitPublicUrl);

    if (!normalizedDraft) {
      toast({ variant: 'error', title: 'Escreva a resposta antes de enviar.' });
      return;
    }

    setReplySending(true);
    try {
      const budgetInputTrimmed = creatorProposedBudgetInput.trim();
      let parsedCreatorBudget: number | undefined;

      if (budgetInputTrimmed.length > 0) {
        const parsed = parseBudgetInput(creatorProposedBudgetInput);
        if (parsed === undefined || parsed === null) {
          throw new Error('Valor de orçamento proposto inválido.');
        }
        parsedCreatorBudget = parsed;
      }

      const requestPayload: Record<string, unknown> = {
        emailText: normalizedDraft,
      };
      if (typeof parsedCreatorBudget === 'number') {
        requestPayload.creatorProposedBudget = parsedCreatorBudget;
      }

      const response = await fetch(`/api/proposals/${selectedProposal.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Não foi possível enviar o e-mail.');
      }

      const payload = await response.json();
      const updated: ProposalDetail | null = payload?.proposal ?? null;
      if (!updated) {
        toast({ variant: 'warning', title: 'E-mail enviado, mas não foi possível atualizar a proposta.' });
        return;
      }

      setSelectedProposal(updated);
      setProposals((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
              ...item,
              status: updated.status,
              budget: updated.budget,
              budgetIntent: updated.budgetIntent,
              currency: updated.currency,
              creatorProposedBudget: updated.creatorProposedBudget,
              creatorProposedCurrency: updated.creatorProposedCurrency,
              creatorProposedAt: updated.creatorProposedAt,
              lastResponseAt: updated.lastResponseAt,
              lastResponseMessage: updated.lastResponseMessage,
            }
            : item
        )
      );
      setCreatorProposedBudgetInput(
        typeof updated.creatorProposedBudget === 'number'
          ? String(updated.creatorProposedBudget)
          : ''
      );
      setReplyDraft(normalizeEmailParagraphs(updated.lastResponseMessage ?? normalizedDraft));

      track('email_sent_via_platform', {
        creator_id: null,
        proposal_id: updated.id,
      });
      toast({ variant: 'success', title: 'Resposta enviada com sucesso.' });
    } catch (error: any) {
      toast({ variant: 'error', title: error?.message || 'Falha ao enviar resposta.' });
    } finally {
      setReplySending(false);
    }
  }, [
    canInteract,
    openPaywall,
    creatorProposedBudgetInput,
    replyDraft,
    resolvePublicMediaKitUrl,
    selectedProposal,
    showUpgradeToast,
    toast,
  ]);

  const handleSelectProposal = useCallback(
    (proposalId: string) => {
      const target = proposals.find((item) => item.id === proposalId);
      setSelectedId(proposalId);
      if (target) {
        setActiveTab(statusToTab(target.status));
      }
      setCurrentStep('detail');
    },
    [proposals]
  );

  const handleCopyMediaKitLink = useCallback(async (context: 'campaigns_header' | 'campaigns_empty_state') => {
    try {
      setIsCopyingMediaKitLink(true);
      const link = await getOrCreateMediaKitUrl();

      if (!link) {
        throw new Error('Não foi possível gerar o link do mídia kit.');
      }

      const copied = await copyTextWithFallback(link);
      if (!copied) {
        throw new Error('Não foi possível copiar o link do mídia kit.');
      }

      toast({ variant: 'success', title: 'Link do mídia kit copiado.' });
      track('media_kit_link_copied', { context });
    } catch (error: any) {
      toast({
        variant: 'error',
        title: error?.message || 'Não foi possível copiar o link do mídia kit.',
      });
    } finally {
      setIsCopyingMediaKitLink(false);
    }
  }, [copyTextWithFallback, getOrCreateMediaKitUrl, toast]);

  const handleCopyProposalFormLink = useCallback(async (context: 'campaigns_header' | 'campaigns_empty_state') => {
    if (sessionStatus === 'unauthenticated') {
      const callbackUrl =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : '/campaigns';
      redirectToGoogleConsentLogin(callbackUrl);
      return;
    }

    try {
      setIsCopyingProposalFormLink(true);
      const mediaKitLink = await getOrCreateMediaKitUrl();
      if (!mediaKitLink) {
        throw new Error('Não foi possível gerar o link do formulário.');
      }

      const proposalFormLink = buildProposalFormUrl(mediaKitLink);
      const copied = await copyTextWithFallback(proposalFormLink);
      if (!copied) {
        throw new Error('Não foi possível copiar o link do formulário.');
      }

      showProposalCopyFeedback();
      void markProposalFormLinkCopied();
      toast({ variant: 'success', title: 'Link copiado. Agora cole na bio do Instagram.' });
      track('copy_proposal_form_link', { context });
    } catch (error: any) {
      toast({
        variant: 'error',
        title: error?.message || 'Não foi possível copiar o link do formulário.',
      });
    } finally {
      setIsCopyingProposalFormLink(false);
    }
  }, [
    getOrCreateMediaKitUrl,
    buildProposalFormUrl,
    copyTextWithFallback,
    showProposalCopyFeedback,
    markProposalFormLinkCopied,
    sessionStatus,
    toast,
  ]);
  const handleBackToInbox = useCallback(() => {
    setCurrentStep('inbox');
    if (!compactView && !isMobile) {
      setSelectedId(null);
      setSelectedProposal(null);
    }
    if (requestedProposalId) {
      router.replace('/campaigns');
    }
  }, [compactView, isMobile, requestedProposalId, router]);
  const linkedScriptIds = useMemo(
    () =>
      new Set(
        campaignLinks.filter((link) => link.entityType === 'script').map((link) => link.entityId)
      ),
    [campaignLinks]
  );
  const linkedPubliIds = useMemo(
    () =>
      new Set(
        campaignLinks.filter((link) => link.entityType === 'publi').map((link) => link.entityId)
      ),
    [campaignLinks]
  );
  const availableScripts = useMemo(
    () => linkableScripts.filter((item) => !linkedScriptIds.has(item.id)),
    [linkableScripts, linkedScriptIds]
  );
  const availablePublis = useMemo(
    () => linkablePublis.filter((item) => !linkedPubliIds.has(item.id)),
    [linkablePublis, linkedPubliIds]
  );
  const detailView = selectedProposal ? (
    <CampaignDetailView
      proposal={selectedProposal}
      compactView={compactView}
      onBack={handleBackToInbox}
      onStatusChange={updateProposalStatus}
      formatDate={formatDate}
      formatMoney={formatMoneyValue}
      canInteract={canInteract}
      isBillingLoading={isBillingLoading}
      onUpgradeClick={() => {
        showUpgradeToast();
        openPaywall('detail_view', 'reply_email');
      }}
      analysisLoading={analysisLoading}
      analysisMessage={analysisMessage}
      analysisV2={analysisV2}
      analysisPricingMeta={analysisPricingMeta}
      viewMode={analysisViewMode}
      onToggleViewMode={() =>
        setAnalysisViewMode((prev) => (prev === 'summary' ? 'expanded' : 'summary'))
      }
      onAnalyze={handleAnalyze}
      replyDraft={replyDraft}
      onReplyDraftChange={(value) => setReplyDraft(normalizeEmailParagraphs(value))}
      replyIntent={replyIntent}
      onReplyIntentChange={applyReplyIntent}
      replyRegenerating={replyRegenerating}
      onRefreshReply={handleRefreshReply}
      budgetInput={creatorProposedBudgetInput}
      onBudgetInputChange={setCreatorProposedBudgetInput}
      onSaveBudget={handleSaveCreatorProposedBudget}
      budgetSaving={proposedBudgetSaving}
      replySending={replySending}
      onSendReply={handleSendReply}
      replyTextareaRef={replyTextareaRef}
      campaignLinks={campaignLinks}
      campaignLinksLoading={linksLoading}
      campaignLinksError={linksError}
      availableScripts={availableScripts}
      availablePublis={availablePublis}
      linkableLoading={linkableLoading}
      linkableError={linkableError}
      linkMutating={linkMutating}
      activeLinkMutationId={activeLinkMutationId}
      onLinkScript={handleLinkScript}
      onLinkPubli={handleLinkPubli}
      onUnlinkEntity={handleUnlinkEntity}
      onUpdateLinkStatus={handleUpdateLinkStatus}
    />
  ) : null;

  const detailLoadingView = (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <header className="sticky top-0 z-20 shrink-0 border-b border-zinc-100 bg-white/95 px-3 py-2 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[42rem] items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-3 w-40 animate-pulse rounded-full bg-zinc-200" />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto w-full max-w-[42rem] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-24 animate-pulse rounded-full bg-zinc-200" />
            <div className="h-4 w-20 animate-pulse rounded-full bg-zinc-200" />
          </div>
          <div className="h-5 w-3/4 animate-pulse rounded-full bg-zinc-200" />
          <div className="space-y-2 border-t border-zinc-100 pt-4">
            <div className="h-3 w-16 animate-pulse rounded-full bg-zinc-200" />
            <div className="h-3 w-full animate-pulse rounded-full bg-zinc-100" />
            <div className="h-3 w-5/6 animate-pulse rounded-full bg-zinc-100" />
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-zinc-100" />
          </div>
          <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </main>
    </div>
  );

  const sortedProposals = useMemo(
    () =>
      [...proposals].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }),
    [proposals]
  );
  const pipelineGroups = useMemo(
    () =>
      PIPELINE_GROUPS.map((group) => {
        const items = sortedProposals.filter((proposal) => group.statuses.includes(proposal.status));
        return {
          ...group,
          items,
          count: items.length,
          totalBudget: items.reduce((acc, proposal) => acc + (proposal.budget || 0), 0),
          currency: items[0]?.currency || 'BRL',
        };
      }),
    [sortedProposals]
  );
  const visiblePipelineGroups = useMemo(
    () => pipelineGroups.filter((group) => group.key !== 'lost' || group.count > 0),
    [pipelineGroups]
  );
  const proposalHeaderCtaDisabled =
    sessionStatus === 'loading' || isBillingLoading || isCopyingProposalFormLink;
  const shouldUseSplitLayout = !compactView && !isMobile && sortedProposals.length > 0;

  if ((compactView || isMobile) && currentStep !== 'inbox') {
    if (detailView) {
      return detailView;
    }
    if (detailLoading) {
      return detailLoadingView;
    }
  }

  const hasProposals = sortedProposals.length > 0;

  const listContent = (
    <>
        <div className={compactView ? "mb-8" : "mb-5"}>
          <div className={`overflow-hidden ${compactView ? "rounded-[1.24rem] border border-zinc-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,246,247,0.94))] px-3.5 py-3" : "rounded-[1.55rem] bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,rgba(253,242,248,0.36),rgba(255,255,255,0.94))] px-4 py-4 ring-1 ring-pink-100/70"}`}>
            <div className={`flex gap-3 ${compactView ? "flex-col items-stretch gap-3" : "flex-col items-stretch sm:flex-row sm:items-end sm:justify-between"}`}>
              <div className="min-w-0">
                <div className={`dashboard-muted-label flex items-center gap-1.5 ${compactView ? "text-zinc-400" : "text-pink-500"}`}>
                  <Copy className={`h-3 w-3 shrink-0 ${compactView ? "text-zinc-400" : "text-pink-500"}`} />
                  <p>Entrada de campanhas</p>
                </div>
                <p className={`dashboard-type-section-title mt-2 ${compactView ? "pr-2 text-[0.97rem] leading-snug" : "max-w-[18rem]"}`}>
                  {compactView
                    ? 'Coloque este formulário na bio.'
                    : 'Deixe o link na bio e centralize novas propostas aqui.'}
                </p>
                <p className={`dashboard-type-meta mt-1 ${compactView ? "pr-2 text-[11px] leading-relaxed" : "max-w-[20rem]"}`}>
                  {compactView
                    ? 'Receba propostas por ele.'
                    : 'Copie o formulário para receber oportunidades de marcas sem perder contexto da negociação.'}
                </p>
              </div>
            <button
              type="button"
              onClick={() => {
                void handleCopyProposalFormLink('campaigns_header');
              }}
              disabled={proposalHeaderCtaDisabled}
              className={`dashboard-primary-button dashboard-type-control inline-flex shrink-0 items-center justify-center px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60 ${
                compactView ? "min-h-[2.55rem] w-full rounded-[0.95rem] shadow-[0_4px_10px_rgba(24,24,27,0.08)]" : "w-full shadow-[0_10px_20px_rgba(24,24,27,0.12)] sm:w-auto"
              }`}
            >
              {isCopyingProposalFormLink
                ? 'Copiando link'
                : proposalCopyFeedbackVisible
                  ? 'Link copiado'
                  : 'Copiar formulário'}
            </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          compactView ? (
            <div className="space-y-3.5">
              <div className="space-y-0">
                {["Novas propostas", "Em negociação", "Fechadas (mês)"].map((label, index) => (
                  <div
                    key={label}
                    className="border-t border-zinc-100/75 py-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-300" />
                        <div className="h-3 w-28 animate-pulse rounded-full bg-zinc-200" />
                        <div className="h-5 w-5 animate-pulse rounded-full bg-zinc-100" />
                      </div>
                      <div className="h-4 w-20 animate-pulse rounded-full bg-zinc-200" />
                    </div>
                    {index <= 1 ? (
                      <div className="mt-3 rounded-[1.25rem] bg-zinc-50/62 px-3.5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="h-3 w-16 animate-pulse rounded-full bg-zinc-200" />
                            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-zinc-200" />
                            <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-zinc-100" />
                          </div>
                          <div className="h-4 w-14 animate-pulse rounded-full bg-zinc-200" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="dashboard-panel h-40 animate-pulse" />
              ))}
            </div>
          )
        ) : !hasProposals ? (
          compactView ? (
            <div className="space-y-0">
              <div className="rounded-[1.18rem] bg-zinc-50/55 px-3.5 py-3.5">
                <p className="dashboard-muted-label text-zinc-400">Pipeline</p>
                <p className="dashboard-type-body mt-1.5 max-w-[18rem] pr-4">
                  Quando a primeira campanha entrar pelo formulário, ela aparece assim.
                </p>
              </div>

              {visiblePipelineGroups.map((group) => {
                const stageVisual = COMPACT_PIPELINE_LIST_VISUALS[group.key];

                return (
                  <section
                    key={group.key}
                    className="border-t border-zinc-100/75 py-4 first:border-t-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] ${stageVisual.headerChipClassName}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${stageVisual.headerDotClassName}`} />
                          </span>
                          <h3 className="dashboard-type-section-title text-[0.98rem] text-zinc-950">
                            {group.label}
                          </h3>
                          <span className="inline-flex h-4 w-5 rounded-full bg-zinc-100/90" aria-hidden="true" />
                        </div>
                      </div>
                      <span className="mt-1 inline-flex h-4 w-20 shrink-0 rounded-full bg-zinc-100/90" aria-hidden="true" />
                    </div>

                    <div className="mt-1.5">
                      <div className="group w-full rounded-[1.15rem] px-3 py-3 text-left">
                        <div className="flex items-start gap-3.5">
                          <span
                            className={`inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ${stageVisual.rankBadgeClassName}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <span className="mt-0.5 inline-flex h-3 w-20 rounded-full bg-zinc-100/95" aria-hidden="true" />
                            </div>
                            <div className="mt-2.5 space-y-2">
                              <span className="block h-4 w-[88%] rounded-full bg-zinc-200/95" aria-hidden="true" />
                              <span className="block h-4 w-[62%] rounded-full bg-zinc-100/95" aria-hidden="true" />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="inline-flex h-3 w-14 rounded-full bg-zinc-100/95" aria-hidden="true" />
                              <span className="h-1 w-1 rounded-full bg-zinc-300" />
                              <span className="inline-flex h-3 w-24 rounded-full bg-zinc-100/95" aria-hidden="true" />
                              <span className="inline-flex h-5 w-16 rounded-full border border-zinc-100/90 bg-zinc-50/88" aria-hidden="true" />
                            </div>
                          </div>
                          <span className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full p-1 transition ${stageVisual.arrowClassName}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="dashboard-type-body mt-0.5 px-3 pr-4 text-zinc-500">
                      {COMPACT_EMPTY_PREVIEW_HELPER_TEXT[group.key]}
                    </p>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty-state p-9 text-center">
              <p className="dashboard-muted-label mx-auto flex w-fit items-center gap-2 text-zinc-400">
                <Copy className="h-3 w-3 text-zinc-400" />
                Entrada de campanhas
              </p>
              <p className="dashboard-type-section-title mx-auto mt-4 max-w-[18rem] text-center leading-8">
                Nenhuma campanha recebida ainda.
              </p>
              <p className="dashboard-type-body mx-auto mt-2 max-w-[20rem] text-center">
                Copie o formulario e coloque na bio para começar a receber propostas.
              </p>
              <button
                type="button"
                onClick={() => {
                  void handleCopyProposalFormLink('campaigns_empty_state');
                }}
                disabled={proposalHeaderCtaDisabled}
                className="dashboard-primary-button dashboard-type-control mt-5 inline-flex min-w-[180px] items-center justify-center px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCopyingProposalFormLink
                  ? 'Copiando link'
                  : proposalCopyFeedbackVisible
                    ? 'Link copiado'
                    : 'Copiar formulário'}
              </button>
            </div>
          )
        ) : (
          compactView ? (
            <div className="space-y-0">
              {visiblePipelineGroups.map((group) => {
                const isExpanded = expandedSections[group.key];
                const collapsedCount = group.key === 'incoming' ? 2 : 1;
                const compactVisibleItems = isExpanded ? group.items : group.items.slice(0, collapsedCount);
                const stageVisual = COMPACT_PIPELINE_LIST_VISUALS[group.key];

                return (
                  <section
                    key={group.key}
                    className="border-t border-zinc-100/75 py-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] ${stageVisual.headerChipClassName}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${stageVisual.headerDotClassName}`} />
                          </span>
                          <h3 className="dashboard-type-section-title text-[0.98rem] text-zinc-950">
                            {group.label}
                          </h3>
                          <span className="dashboard-type-control inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-zinc-50 px-1.5 py-0.5 text-zinc-400">
                            {group.count}
                          </span>
                        </div>
                      </div>
                      <span className="dashboard-type-kpi-sm shrink-0 tabular-nums text-zinc-900">
                        {group.count > 0 ? formatMoneyValue(group.totalBudget, group.currency) : 'R$ 0'}
                      </span>
                    </div>

                    {group.items.length === 0 ? (
                      <p className="dashboard-type-body mt-2.5 pr-4">{group.emptyLabel}</p>
                    ) : (
                      <div className="mt-1 space-y-1.5">
                        {compactVisibleItems.map((proposal, index) => {
                          const urgency = getProposalUrgencyMeta(proposal);
                          const budgetLabel =
                            proposal.budget !== null
                              ? formatMoneyValue(proposal.budget, proposal.currency)
                              : proposal.budgetIntent === 'requested'
                                ? 'A combinar'
                                : '—';

                          return (
                            <button
                              key={proposal.id}
                              type="button"
                              onClick={() => handleSelectProposal(proposal.id)}
                              className="group w-full rounded-[1.15rem] px-3 py-3 text-left transition hover:bg-zinc-50/42 focus-visible:bg-zinc-50/56 focus-visible:outline-none"
                            >
                              <div className="flex items-start gap-3.5">
                                <span
                                  className={`dashboard-type-control inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ${stageVisual.rankBadgeClassName}`}
                                >
                                  {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <p
                                      className={`dashboard-muted-label truncate text-zinc-400 transition ${stageVisual.labelHoverClassName}`}
                                    >
                                      {proposal.brandName || 'Marca'}
                                    </p>
                                  </div>
                                  <h4 className="dashboard-type-item-title mt-1.5 line-clamp-2 pr-2 text-zinc-900">
                                    {proposal.campaignTitle || 'Campanha sem título'}
                                  </h4>
                                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="dashboard-type-meta tabular-nums font-medium text-zinc-700">
                                      {budgetLabel}
                                    </span>
                                    <span className="h-1 w-1 rounded-full bg-zinc-300" />
                                    <p className="dashboard-type-meta min-w-0 flex-1 truncate text-zinc-500">
                                      {getProposalMomentLabel(proposal)}
                                    </p>
                                    <span className={`dashboard-type-control inline-flex items-center gap-1 rounded-full border border-zinc-100/90 bg-zinc-50/88 px-2 py-0.5 text-[9px] ${urgency.textClassName}`}>
                                      <span className={`h-1 w-1 rounded-full ${urgency.dotClassName}`} />
                                      {urgency.label}
                                    </span>
                                  </div>
                                </div>
                                <span className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full p-1 transition ${stageVisual.arrowClassName}`}>
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            </button>
                          );
                        })}

                        {group.items.length > collapsedCount ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSections((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                            }
                            className={`dashboard-muted-label inline-flex items-center gap-1 rounded-full px-3 py-1 transition hover:text-zinc-700 ${stageVisual.summaryClassName}`}
                          >
                            {isExpanded
                              ? 'Mostrar menos'
                              : `+${group.items.length - collapsedCount} ${group.items.length - collapsedCount === 1 ? 'campanha' : 'campanhas'} nesta etapa`}
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
          <div className="divide-y divide-zinc-100/65">
            {visiblePipelineGroups.map((group) => {
              const isExpanded = expandedSections[group.key];
              const compactVisibleItems = compactView ? group.items.slice(0, 1) : group.items;
              const stageVisual = COMPACT_PIPELINE_LIST_VISUALS[group.key];

              return (
                <section
                  key={group.key}
                  className="py-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const nextExpanded = !isExpanded;
                      setActiveTab(group.key);
                      setExpandedSections({
                        incoming: false,
                        negotiation: false,
                        won: false,
                        lost: false,
                        [group.key]: nextExpanded,
                      });
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-[1.2rem] px-0 py-2.5 text-left transition hover:bg-zinc-50/28"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-1 w-1 rounded-full ${group.dotClassName}`} />
                        <h3 className="dashboard-muted-label truncate text-zinc-500">
                          {group.label}
                        </h3>
                        <span className={`dashboard-type-control inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 opacity-90 ${group.pillClassName}`}>
                          {group.count}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`dashboard-type-kpi-sm tabular-nums ${group.totalClassName} text-zinc-700`}>
                        {group.count > 0 ? formatMoneyValue(group.totalBudget, group.currency) : "R$ 0"}
                      </span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="bg-transparent pb-2 pt-0.5">
                      {group.items.length === 0 ? (
                        <div className="mt-2 rounded-[1.15rem] bg-zinc-50/34 px-4 py-4 text-center text-sm text-zinc-500">
                          {group.emptyLabel}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {compactVisibleItems.map((proposal, index) => {
                            const urgency = getProposalUrgencyMeta(proposal);
                            const budgetLabel =
                              proposal.budget !== null
                                ? formatMoneyValue(proposal.budget, proposal.currency)
                                : proposal.budgetIntent === "requested"
                                  ? "A combinar"
                                  : "—";

                            return (
                              <button
                                key={proposal.id}
                                type="button"
                                onClick={() => handleSelectProposal(proposal.id)}
                                className="group flex w-full items-start gap-4 rounded-[1.35rem] px-3 py-2.5 text-left transition hover:bg-zinc-50/22 focus-visible:bg-zinc-50/34 focus-visible:outline-none"
                              >
                                <span
                                  className={`dashboard-type-control inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ${stageVisual.rankBadgeClassName}`}
                                >
                                  {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <p
                                      className={`dashboard-muted-label truncate text-zinc-400 transition ${stageVisual.labelHoverClassName}`}
                                    >
                                      {proposal.brandName || "Marca"}
                                    </p>
                                    <div className="shrink-0 text-right">
                                      <span className="dashboard-type-kpi-sm tabular-nums">{budgetLabel}</span>
                                    </div>
                                  </div>
                                  <h4 className="dashboard-type-item-title mt-1.5 line-clamp-2">
                                    {proposal.campaignTitle || "Campanha sem título"}
                                  </h4>
                                  <div className="dashboard-type-meta mt-3 flex items-center gap-2">
                                    <p className="min-w-0 flex-1 truncate">{getProposalMomentLabel(proposal)}</p>
                                    <span className={`dashboard-type-control inline-flex items-center gap-1 rounded-full border border-zinc-100/90 bg-zinc-100/60 px-2 py-0.5 text-[9px] ${urgency.textClassName}`}>
                                      <span className={`h-1 w-1 rounded-full ${urgency.dotClassName}`} />
                                      {urgency.label}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                          {compactView && group.items.length > compactVisibleItems.length ? (
                            <p className="dashboard-muted-label px-3 text-zinc-400">
                              +{group.items.length - compactVisibleItems.length} {group.items.length - compactVisibleItems.length === 1 ? "campanha" : "campanhas"} nesta etapa
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
          )
        )}
    </>
  );

  return (
    <div className={`bg-transparent ${compactView ? "pb-6" : "pb-10"}`}>
      <div className={compactView ? "px-1 py-1" : "px-2 py-1"}>
        {shouldUseSplitLayout ? (
          <div className="grid min-h-[calc(100vh-17rem)] gap-5 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
            <div className="min-w-0">{listContent}</div>
            <div className="dashboard-panel min-h-0 overflow-hidden">
              {detailView ? (
                detailView
              ) : detailLoading ? (
                detailLoadingView
              ) : (
                <div className="flex h-full min-h-[560px] flex-col items-center justify-center px-8 text-center">
                  <p className="dashboard-muted-label text-zinc-400">Detalhe da campanha</p>
                  <p className="dashboard-type-section-title mt-3">Selecione uma campanha para abrir o contexto.</p>
                  <p className="dashboard-type-body mt-2 max-w-md">
                    Use a coluna da esquerda para acompanhar briefing, ativos e resposta sem trocar de tela.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          listContent
        )}
      </div>
    </div>
  );
}
