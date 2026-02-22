/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';

import { useToast } from '@/app/components/ui/ToastA11yProvider';
import useBillingStatus from '@/app/hooks/useBillingStatus';
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

import CampaignCard from './components/CampaignCard';
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

function formatGapLabel(value: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value === 0) return 'igual ao recomendado';
  const abs = Math.abs(value).toFixed(1).replace('.', ',');
  return `${abs}% ${value > 0 ? 'acima' : 'abaixo'} do recomendado`;
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

export default function ProposalsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const billingStatus = useBillingStatus();
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
  const [isMediaKitLoading, setIsMediaKitLoading] = useState(true);
  const [isCopyingMediaKitLink, setIsCopyingMediaKitLink] = useState(false);
  const [isCopyingProposalFormLink, setIsCopyingProposalFormLink] = useState(false);
  const [proposalCopyFeedbackVisible, setProposalCopyFeedbackVisible] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  const notifiedProposalsRef = useRef<Set<string>>(new Set());
  const lockViewedRef = useRef(false);
  const pendingScrollToDetailRef = useRef(false);
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

  const analyzeButtonRef = useRef<HTMLButtonElement | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sendReplyButtonRef = useRef<HTMLButtonElement | null>(null);
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
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
    return `${window.location.origin}/media-kit/${selectedProposal.mediaKitSlug}`;
  }, [mediaKitUrl, selectedProposal?.mediaKitSlug]);

  const showUpgradeToast = useCallback(() => {
    toast({
      variant: 'info',
      title: 'Recurso exclusivo do Plano Pro',
      description: 'Responder pela plataforma faz parte do Plano Pro.',
    });
  }, [toast]);

  const openPaywall = useCallback(
    (source: string, context: PaywallContext) => {
      const normalizedPlan = billingStatus.normalizedStatus ?? billingStatus.planStatus ?? null;
      const telemetryContext =
        context === 'default'
          ? 'other'
          : context === 'whatsapp'
            ? 'whatsapp_ai'
            : context;
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

    let link = mediaKitUrl;
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
  }, [mediaKitUrl]);

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
      await fetch('/api/dashboard/home/proposal-link-copied', {
        method: 'POST',
      });
    } catch {
      // falha de marcação não deve bloquear fluxo de cópia
    }
  }, []);

  const loadProposals = useCallback(async () => {
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
  }, [requestedProposalId, toast]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMediaKit() {
      try {
        setIsMediaKitLoading(true);
        const response = await fetch('/api/users/media-kit-token', { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) setMediaKitUrl(null);
          return;
        }

        const payload = await response.json().catch(() => null);
        if (!cancelled) {
          setMediaKitUrl(payload?.url ?? payload?.publicUrl ?? null);
        }
      } catch {
        if (!cancelled) setMediaKitUrl(null);
      } finally {
        if (!cancelled) setIsMediaKitLoading(false);
      }
    }

    fetchMediaKit();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!pendingScrollToDetailRef.current) return;
    if (!selectedProposal) return;
    if (typeof window === 'undefined') return;

    pendingScrollToDetailRef.current = false;
    window.requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [selectedProposal]);

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
    if (currentStep === 'inbox') return;
    if (!selectedProposal?.id) return;

    void loadCampaignWorkspace(selectedProposal.id);
  }, [currentStep, loadCampaignWorkspace, selectedProposal?.id]);

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

    if (!canInteract) {
      showUpgradeToast();
      openPaywall('send_reply', 'reply_email');
      return;
    }

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

      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        pendingScrollToDetailRef.current = true;
      }
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
    if (!hasProAccess) {
      showUpgradeToast();
      openPaywall(context, 'reply_email');
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
    hasProAccess,
    showUpgradeToast,
    openPaywall,
    getOrCreateMediaKitUrl,
    buildProposalFormUrl,
    copyTextWithFallback,
    showProposalCopyFeedback,
    markProposalFormLinkCopied,
    toast,
  ]);



  const shouldShowUpgradeBanner = !canInteract && !isBillingLoading;
  const handleBackToInbox = useCallback(() => {
    setCurrentStep('inbox');
    if (requestedProposalId) {
      router.replace('/campaigns');
    }
  }, [requestedProposalId, router]);
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

  if (currentStep !== 'inbox' && selectedProposal) {
    return (
      <CampaignDetailView
        proposal={selectedProposal}
        onBack={handleBackToInbox}
        onStatusChange={updateProposalStatus}
        formatDate={formatDate}
        formatMoney={formatMoneyValue}
        formatGapLabel={formatGapLabel}
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
    );
  }

  const tabs: Array<{ key: InboxTab; label: string; statuses: ProposalStatus[] }> = [
    { key: 'incoming', label: 'Recebidas', statuses: ['novo', 'visto'] },
    { key: 'negotiation', label: 'Em negociação', statuses: ['respondido'] },
    { key: 'won', label: 'Fechadas', statuses: ['aceito'] },
    { key: 'lost', label: 'Perdidas', statuses: ['rejeitado'] },
  ];
  const TAB_THEME: Record<InboxTab, { active: string; inactive: string; activeMuted: string; inactiveMuted: string }> = {
    incoming: {
      active: 'bg-sky-50 text-sky-800 border border-sky-200 shadow-sm',
      inactive: 'bg-white text-sky-700 border border-sky-200 hover:bg-sky-50/50',
      activeMuted: 'text-sky-600',
      inactiveMuted: 'text-sky-500',
    },
    negotiation: {
      active: 'bg-amber-50 text-amber-800 border border-amber-200 shadow-sm',
      inactive: 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50/50',
      activeMuted: 'text-amber-600',
      inactiveMuted: 'text-amber-500',
    },
    won: {
      active: 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm',
      inactive: 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50/50',
      activeMuted: 'text-emerald-600',
      inactiveMuted: 'text-emerald-500',
    },
    lost: {
      active: 'bg-rose-50 text-rose-800 border border-rose-200 shadow-sm',
      inactive: 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50/50',
      activeMuted: 'text-rose-600',
      inactiveMuted: 'text-rose-500',
    },
  };

  const currentTab = tabs.find((t) => t.key === activeTab) || tabs[0]!;
  const filteredProposals = proposals
    .filter((p) => currentTab.statuses.includes(p.status))
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  const proposalHeaderCtaLabel = !hasProAccess
    ? 'Ativar assinatura'
    : isCopyingProposalFormLink
      ? 'Copiando...'
      : proposalCopyFeedbackVisible
        ? 'Copiado. Cole na bio'
        : 'Copiar link de proposta';
  const proposalHeaderCtaDisabled = isBillingLoading || isCopyingProposalFormLink;

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="dashboard-page-shell py-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Campanhas</h1>
            <p className="mt-1 text-slate-500">Gerencie propostas e receba novas oportunidades.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleCopyProposalFormLink('campaigns_header');
            }}
            disabled={proposalHeaderCtaDisabled}
            className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-bold transition ${
              hasProAccess
                ? 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                : 'bg-pink-600 text-white hover:bg-pink-700'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {proposalHeaderCtaLabel}
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const tabProposals = proposals.filter((p) => tab.statuses.includes(p.status));
              const count = tabProposals.length;
              const tabTone = TAB_THEME[tab.key];

              const totalValue = tabProposals.reduce((acc, curr) => acc + (curr.budget || 0), 0);
              // Use currency from first item or default to BRL. 
              // In mixed currency scenarios this is an approximation, but acceptable for this iteration.
              const currency = tabProposals[0]?.currency || 'BRL';
              const formattedTotal = count > 0 ? formatMoneyValue(totalValue, currency) : null;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-col items-start gap-0.5 rounded-2xl px-5 py-2.5 text-sm font-semibold transition whitespace-nowrap min-w-[120px]
                                ${isActive
                      ? `${tabTone.active} transform scale-[1.02]`
                      : tabTone.inactive
                    }`}
                >
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? tabTone.activeMuted : tabTone.inactiveMuted}`}>
                    {tab.label}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold leading-none">
                      {formattedTotal || "—"}
                    </span>
                    <span className={`text-xs font-medium ${isActive ? tabTone.activeMuted : tabTone.inactiveMuted}`}>
                      ({count})
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {shouldShowUpgradeBanner ? (
          <div className="mb-6 rounded-2xl border border-pink-100 bg-gradient-to-r from-white to-pink-50/30 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Desbloqueie a IA de negociação</p>
                <p className="text-xs text-slate-600">
                  Análise inteligente + resposta com 1 clique.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  showUpgradeToast();
                  openPaywall('banner', 'reply_email');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-pink-700 shadow-sm shadow-pink-200"
              >
                <Lock className="h-3.5 w-3.5" />
                Desbloquear IA
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-60 rounded-[2rem] bg-slate-50 animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
            <p className="text-slate-900 font-semibold">Nenhuma campanha nesta etapa.</p>
            <p className="text-slate-500 text-sm mt-1">
              Copie o formulário de proposta e coloque na bio. As respostas chegam aqui.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCopyProposalFormLink('campaigns_empty_state');
                }}
                disabled={proposalHeaderCtaDisabled}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-bold transition ${
                  hasProAccess
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-pink-600 text-white hover:bg-pink-700'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {!hasProAccess
                  ? 'Ativar assinatura'
                  : isCopyingProposalFormLink
                    ? 'Copiando...'
                    : proposalCopyFeedbackVisible
                      ? 'Copiado. Cole na bio'
                      : 'Copiar link de proposta'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCopyMediaKitLink('campaigns_empty_state');
                }}
                disabled={isCopyingMediaKitLink || isMediaKitLoading}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCopyingMediaKitLink ? 'Copiando kit...' : 'Copiar link do mídia kit'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProposals.map((proposal) => (
              <CampaignCard
                key={proposal.id}
                proposal={proposal}
                onClick={() => handleSelectProposal(proposal.id)}
                onStatusChange={updateProposalStatus}
                formatMoney={formatMoneyValue}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
