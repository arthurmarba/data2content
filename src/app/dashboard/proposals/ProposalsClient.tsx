/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Inbox,
  RefreshCcw,
  Send,
  MessageSquare,
  ClipboardCopy,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastA11yProvider';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { track } from '@/lib/track';
import { emptyStates } from '@/constants/emptyStates';
import type { PaywallContext } from '@/types/paywall';
import { PAYWALL_RETURN_STORAGE_KEY } from '@/types/paywall';
import { openPaywallModal } from '@/utils/paywallModal';

type ProposalStatus = 'novo' | 'visto' | 'respondido' | 'aceito' | 'rejeitado';

interface ProposalListItem {
  id: string;
  brandName: string;
  campaignTitle: string;
  status: ProposalStatus;
  budget: number | null;
  currency: string;
  createdAt: string | null;
  lastResponseAt: string | null;
  lastResponseMessage: string | null;
}

interface ProposalDetail extends ProposalListItem {
  contactEmail: string;
  contactWhatsapp: string | null;
  campaignDescription: string | null;
  deliverables: string[];
  referenceLinks: string[];
  originIp: string | null;
  userAgent: string | null;
  mediaKitSlug: string | null;
  updatedAt: string | null;
}

const STATUS_LABELS: Record<ProposalStatus, string> = {
  novo: 'Nova',
  visto: 'Vista',
  respondido: 'Respondida',
  aceito: 'Aceita',
  rejeitado: 'Rejeitada',
};

const STATUS_COLORS: Record<ProposalStatus, string> = {
  novo: 'bg-amber-100 text-amber-700',
  visto: 'bg-slate-100 text-slate-600',
  respondido: 'bg-sky-100 text-sky-700',
  aceito: 'bg-emerald-100 text-emerald-700',
  rejeitado: 'bg-red-100 text-red-700',
};

type PipelineStageKey = 'incoming' | 'negotiation' | 'won' | 'lost';

interface PipelineStageConfig {
  key: PipelineStageKey;
  label: string;
  statuses: ProposalStatus[];
  dropStatus: ProposalStatus;
  tone: string;
  emptyLabel: string;
}

const PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    key: 'incoming',
    label: 'Recebido',
    statuses: ['novo', 'visto'],
    dropStatus: 'novo',
    tone: 'from-amber-50 via-white to-white',
    emptyLabel: 'Ainda sem novas propostas.',
  },
  {
    key: 'negotiation',
    label: 'Negociação',
    statuses: ['respondido'],
    dropStatus: 'respondido',
    tone: 'from-blue-50 via-white to-white',
    emptyLabel: 'Sem negociações em andamento.',
  },
  {
    key: 'won',
    label: 'Fechado',
    statuses: ['aceito'],
    dropStatus: 'aceito',
    tone: 'from-emerald-50 via-white to-white',
    emptyLabel: 'Nenhuma campanha fechada por aqui.',
  },
  {
    key: 'lost',
    label: 'Perdido',
    statuses: ['rejeitado'],
    dropStatus: 'rejeitado',
    tone: 'from-rose-50 via-white to-white',
    emptyLabel: 'Zero recusas registradas.',
  },
];

const PIPELINE_GAP_PX = 16;

interface PipelineStageData extends PipelineStageConfig {
  items: ProposalListItem[];
  amount: number;
  currency: string;
  count: number;
}

const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
    maximumFractionDigits: 2,
  });

function formatDate(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProposalsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const billingStatus = useBillingStatus();
  const [isLoading, setIsLoading] = useState(true);
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<ProposalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState<string>('');
  const [replySending, setReplySending] = useState(false);
  const [replyRegenerating, setReplyRegenerating] = useState(false);
  const [draggedProposalId, setDraggedProposalId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStageKey | null>(null);
  const [isCopyingMediaKitLink, setIsCopyingMediaKitLink] = useState(false);
  const [mediaKitUrl, setMediaKitUrl] = useState<string | null>(null);
  const [isMediaKitLoading, setIsMediaKitLoading] = useState(true);
  const lockViewedRef = useRef(false);
  const notifiedProposalsRef = useRef<Set<string>>(new Set());
  const paywallResumeHandledRef = useRef(false);
  const [pendingReturn, setPendingReturn] = useState<{
    proposalId: string | null;
    returnTo: string | null;
    context: PaywallContext;
  } | null>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sendReplyButtonRef = useRef<HTMLButtonElement | null>(null);
  const detailsSectionRef = useRef<HTMLElement | null>(null);
  const detailsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const pipelineCarouselRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToDetailsRef = useRef(false);
  const aiUsedRef = useRef(false);
  const [pipelinePage, setPipelinePage] = useState(0);
  const buildReturnTo = useCallback(
    (proposalId?: string | null) => {
      const targetId = proposalId ?? selectedProposal?.id ?? null;
      if (!targetId) return null;
      return `/dashboard/proposals?proposalId=${encodeURIComponent(targetId)}`;
    },
    [selectedProposal]
  );

  const hasProAccess = Boolean(billingStatus.hasPremiumAccess);
  const isBillingLoading = Boolean(billingStatus.isLoading);
  const canInteract = hasProAccess && !isBillingLoading;
  const upgradeMessage = 'Responder pela plataforma é PRO.';
  const upgradeSubtitle =
    'Ative o PRO para enviar com IA em 1 clique e negociar com a faixa justa automática.';
  const tooltipAnalyzePro = 'Disponível no PRO: análise com IA e faixa justa automática.';
  const showUpgradeToast = useCallback(() => {
    toast({
      variant: 'info',
      title: 'Recurso exclusivo do plano PRO',
      description: upgradeMessage,
    });
  }, [toast, upgradeMessage]);

  const openPaywall = useCallback(
    (
      source: string,
      context: PaywallContext,
      options?: { returnTo?: string | null; proposalId?: string | null }
    ) => {
      const normalizedPlan = billingStatus.normalizedStatus ?? billingStatus.planStatus ?? null;

      track('pro_feature_upgrade_clicked', {
        feature: 'proposals_reply',
        source,
      });
      const telemetryContext =
        context === 'default'
          ? 'other'
          : (context as
              | 'planner'
              | 'planning'
              | 'discover'
              | 'whatsapp_ai'
              | 'reply_email'
              | 'ai_analysis'
              | 'calculator'
              | 'other'
              | null
              | undefined);

      track('paywall_viewed', {
        creator_id: null,
        context: telemetryContext,
        plan: normalizedPlan,
      });

      if (typeof window !== 'undefined') {
        const returnTo = options?.returnTo ?? null;
        const proposalId = options?.proposalId ?? null;
        if (returnTo || proposalId) {
          try {
            window.sessionStorage.setItem(
              PAYWALL_RETURN_STORAGE_KEY,
              JSON.stringify({
                context,
                returnTo,
                proposalId,
                source,
                ts: Date.now(),
              })
            );
          } catch {
            /* ignore storage errors */
          }
        }
      }

      openPaywallModal({
        context,
        source,
        returnTo: options?.returnTo ?? null,
        proposalId: options?.proposalId ?? null,
      });
    },
    [billingStatus.normalizedStatus, billingStatus.planStatus]
  );

  const loadProposals = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/proposals`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Não foi possível carregar as propostas.');
      }
      const payload = await response.json();
      const items = (payload?.items ?? []) as ProposalListItem[];
      setProposals(items);
      if (items.length > 0) {
        setSelectedId((prev) => {
          if (prev && items.some((item) => item.id === prev)) {
            return prev;
          }
          return items[0]?.id ?? null;
        });
      } else {
        setSelectedId(null);
        setSelectedProposal(null);
      }
    } catch (error: any) {
      toast({ variant: 'error', title: error?.message || 'Erro ao carregar propostas.' });
      setProposals([]);
      setSelectedId(null);
      setSelectedProposal(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    let cancelled = false;
    async function fetchMediaKit() {
      try {
        setIsMediaKitLoading(true);
        const response = await fetch('/api/users/media-kit-token', { cache: 'no-store' });
        if (!response.ok) {
          setMediaKitUrl(null);
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!payload?.url && !payload?.publicUrl) {
          setMediaKitUrl(null);
          return;
        }
        if (!cancelled) {
          setMediaKitUrl(payload.url ?? payload.publicUrl ?? null);
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
    if (!pendingReturn?.proposalId) return;
    if (!proposals.length) return;
    if (!proposals.some((item) => item.id === pendingReturn.proposalId)) return;
    if (selectedId !== pendingReturn.proposalId) {
      setSelectedId(pendingReturn.proposalId);
    }
  }, [pendingReturn, proposals, selectedId]);

  useEffect(() => {
    if (!pendingReturn) return;
    if (!hasProAccess) return;
    if (pendingReturn.proposalId && selectedProposal?.id !== pendingReturn.proposalId) return;

    if (pendingReturn.context === 'reply_email') {
      replyTextareaRef.current?.focus({ preventScroll: false });
    } else if (pendingReturn.context === 'ai_analysis') {
      analyzeButtonRef.current?.focus({ preventScroll: false });
    }
    setPendingReturn(null);
  }, [pendingReturn, hasProAccess, selectedProposal]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedProposal(null);
      setAnalysisMessage(null);
      setReplyDraft('');
      setReplySending(false);
      setReplyRegenerating(false);
      aiUsedRef.current = false;
      return;
    }
    let cancelled = false;
    aiUsedRef.current = false;
    async function fetchDetail() {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/proposals/${selectedId}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Não foi possível carregar os detalhes da proposta.');
        }
        const payload = (await response.json()) as ProposalDetail;
        if (!cancelled) {
          setSelectedProposal(payload);
          setAnalysisMessage(null);
          setReplyDraft(payload.lastResponseMessage ?? '');
          if (payload.status === 'novo') {
            await updateProposalStatus(payload.id, 'visto', false);
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          toast({ variant: 'error', title: error?.message || 'Erro ao carregar detalhes.' });
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
      /* ignore network errors */
    });
  }, [selectedProposal, hasProAccess, isBillingLoading]);

  useEffect(() => {
    if (!hasProAccess || isBillingLoading || paywallResumeHandledRef.current) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const ts = typeof data?.ts === 'number' ? data.ts : null;
      if (ts && Date.now() - ts > 1000 * 60 * 60 * 24) {
        window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
        paywallResumeHandledRef.current = true;
        return;
      }
      const allowed: PaywallContext[] = ['default', 'reply_email', 'ai_analysis', 'calculator', 'planning'];
      const context = allowed.includes(data?.context) ? (data.context as PaywallContext) : 'default';
      const proposalId =
        typeof data?.proposalId === 'string' && data.proposalId ? data.proposalId : null;
      const returnToRaw = typeof data?.returnTo === 'string' ? data.returnTo : null;
      const returnTo =
        returnToRaw && returnToRaw.startsWith('/') && !returnToRaw.startsWith('//') ? returnToRaw : null;

      window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
      paywallResumeHandledRef.current = true;
      setPendingReturn({ proposalId, returnTo, context });

      if (returnTo) {
        const current = `${window.location.pathname}${window.location.search || ''}`;
        if (current !== returnTo) {
          router.push(returnTo);
        }
      }
    } catch {
      try {
        window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [hasProAccess, isBillingLoading, router]);

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

  const requestAnalysis = useCallback(async () => {
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
      throw new Error(message);
    }
    return body;
  }, [selectedProposal]);

  const handleAnalyze = useCallback(async () => {
    if (!canInteract) {
      showUpgradeToast();
      openPaywall('analyze_button', 'ai_analysis', {
        returnTo: buildReturnTo(selectedProposal?.id),
        proposalId: selectedProposal?.id ?? null,
      });
      return;
    }
    try {
      setAnalysisLoading(true);
      const payload = await requestAnalysis();
      setAnalysisMessage(payload?.analysis ?? null);
      setReplyDraft(payload?.replyDraft ?? '');
      aiUsedRef.current = true;
      toast({ variant: 'success', title: 'Diagnóstico do Mobi pronto!' });
    } catch (error: any) {
      toast({ variant: 'error', title: error?.message || 'Erro ao acionar o Mobi.' });
    } finally {
      setAnalysisLoading(false);
    }
  }, [buildReturnTo, canInteract, openPaywall, requestAnalysis, selectedProposal, showUpgradeToast, toast]);

  const handleRefreshReply = useCallback(async () => {
    if (!canInteract) {
      showUpgradeToast();
      openPaywall('refresh_reply', 'reply_email', {
        returnTo: buildReturnTo(selectedProposal?.id),
        proposalId: selectedProposal?.id ?? null,
      });
      return;
    }
    try {
      setReplyRegenerating(true);
      const payload = await requestAnalysis();
      setAnalysisMessage(payload?.analysis ?? null);
      setReplyDraft(payload?.replyDraft ?? '');
      aiUsedRef.current = true;
      toast({ variant: 'success', title: 'Sugestão atualizada com uma nova abordagem.' });
    } catch (error: any) {
      toast({ variant: 'error', title: error?.message || 'Não consegui gerar outra sugestão agora.' });
    } finally {
      setReplyRegenerating(false);
    }
  }, [buildReturnTo, canInteract, openPaywall, requestAnalysis, selectedProposal, showUpgradeToast, toast]);

  const handleSendReply = useCallback(async () => {
    if (!canInteract) {
      showUpgradeToast();
      openPaywall('send_reply', 'reply_email', {
        returnTo: buildReturnTo(selectedProposal?.id),
        proposalId: selectedProposal?.id ?? null,
      });
      return;
    }
    if (!selectedProposal) return;
    const trimmed = replyDraft.trim();
    if (!trimmed) {
      toast({ variant: 'error', title: 'Escreva a resposta antes de enviar.' });
      return;
    }
    setReplySending(true);
    try {
      const response = await fetch(`/api/proposals/${selectedProposal.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText: trimmed }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Não foi possível enviar o e-mail.');
      }
      const payload = await response.json();
      const updated: ProposalDetail | null = payload?.proposal ?? null;
      if (updated) {
        setSelectedProposal(updated);
        setProposals((prev) =>
          prev.map((item) =>
            item.id === updated.id
              ? {
                  ...item,
                  status: updated.status,
                  budget: updated.budget,
                  currency: updated.currency,
                  lastResponseAt: updated.lastResponseAt,
                  lastResponseMessage: updated.lastResponseMessage,
                }
              : item
          )
        );
        setReplyDraft(updated.lastResponseMessage ?? trimmed);
        toast({ variant: 'success', title: 'Resposta enviada à marca com sucesso.' });
        track('email_sent_via_platform', {
          creator_id: null,
          proposal_id: updated.id,
        });
        aiUsedRef.current = false;
      } else {
        toast({ variant: 'warning', title: 'Resposta enviada, mas não foi possível atualizar a proposta.' });
      }
    } catch (error: any) {
      toast({ variant: 'error', title: error?.message || 'Falha ao enviar resposta.' });
    } finally {
      setReplySending(false);
    }
  }, [buildReturnTo, canInteract, openPaywall, replyDraft, selectedProposal, showUpgradeToast, toast]);

  const { pipelineStagesData, summaryCards } = useMemo(() => {
    const stageList: PipelineStageData[] = PIPELINE_STAGES.map((stage) => {
      const items = proposals
        .filter((proposal) => stage.statuses.includes(proposal.status))
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      const amount = items.reduce((sum, proposal) => sum + (proposal.budget ?? 0), 0);
      const currency = items.find((proposal) => proposal.currency)?.currency ?? 'BRL';
      return {
        ...stage,
        items,
        amount,
        currency,
        count: items.length,
      };
    });

    const collectCurrency = (items: ProposalListItem[]) =>
      items.find((proposal) => proposal.currency)?.currency ?? 'BRL';

    const openStages = stageList.filter((stage) => stage.key === 'incoming' || stage.key === 'negotiation');
    const wonStage = stageList.find((stage) => stage.key === 'won');
    const lostStage = stageList.find((stage) => stage.key === 'lost');

    const openAmount = openStages.reduce((sum, stage) => sum + stage.amount, 0);
    const wonAmount = wonStage?.amount ?? 0;
    const lostAmount = lostStage?.amount ?? 0;

    const summaryCards = [
      {
        label: 'Em aberto',
        value: currencyFormatter(collectCurrency(openStages.flatMap((stage) => stage.items))).format(openAmount),
        highlight: openAmount > 0,
      },
      {
        label: 'Fechado',
        value: currencyFormatter(collectCurrency(wonStage?.items ?? [])).format(wonAmount),
        highlight: wonAmount > 0,
      },
      {
        label: 'Perdido',
        value: currencyFormatter(collectCurrency(lostStage?.items ?? [])).format(lostAmount),
        highlight: lostAmount > 0,
      },
    ];

    return { pipelineStagesData: stageList, summaryCards };
  }, [proposals]);

  const lastActionDate =
    selectedProposal?.lastResponseAt ?? selectedProposal?.updatedAt ?? selectedProposal?.createdAt ?? null;
  const deliverablesCount = selectedProposal?.deliverables?.length ?? 0;
  const referenceLinksCount = selectedProposal?.referenceLinks?.length ?? 0;

  const summaryTiles = useMemo(() => {
    if (!selectedProposal) return [];
    const budgetValue =
      selectedProposal.budget != null
        ? currencyFormatter(selectedProposal.currency).format(selectedProposal.budget)
        : '—';
    const budgetHelper =
      selectedProposal.budget != null
        ? `Atualizado em ${formatDate(selectedProposal.updatedAt)}`
        : 'Sem orçamento informado';

    const deliverableLabel =
      deliverablesCount > 0 ? `${deliverablesCount} item${deliverablesCount > 1 ? 's' : ''}` : '—';
    const deliverableHelper =
      deliverablesCount > 0 ? 'Veja detalhes no briefing' : 'Aguardando escopo';

    const contactHelper = selectedProposal.contactWhatsapp
      ? `WhatsApp ${selectedProposal.contactWhatsapp}`
      : 'Sem WhatsApp cadastrado';

    const lastActionHelper = selectedProposal.lastResponseAt
      ? 'Resposta enviada'
      : selectedProposal.status === 'novo'
      ? 'Ainda não visualizada'
      : 'Aguardando ação';

    return [
      {
        key: 'budget',
        label: 'Orçamento indicado',
        value: budgetValue,
        helper: budgetHelper,
      },
      {
        key: 'deliverables',
        label: 'Entregáveis',
        value: deliverableLabel,
        helper: deliverableHelper,
      },
      {
        key: 'contact',
        label: 'Contato principal',
        value: selectedProposal.contactEmail || '—',
        helper: contactHelper,
      },
      {
        key: 'last-action',
        label: 'Última ação',
        value: lastActionDate ? formatDate(lastActionDate) : '—',
        helper: lastActionHelper,
      },
    ];
  }, [selectedProposal, deliverablesCount, lastActionDate]);

  const totalPipelineStages = pipelineStagesData.length;

  const handleCopyMediaKitLink = useCallback(async () => {
    try {
      setIsCopyingMediaKitLink(true);
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

      let link = await getLink('GET');
      if (!link) {
        link = await getLink('POST');
      }

      if (!link) {
        throw new Error('Não foi possível gerar o link do Mídia Kit.');
      }

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const temp = document.createElement('textarea');
        temp.value = link;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }

      toast({ variant: 'success', title: 'Link do Mídia Kit copiado!' });
      track('media_kit_link_copied', { context: 'campaigns_empty_state' });
    } catch (error: any) {
      toast({
        variant: 'error',
        title: error?.message || 'Não foi possível copiar o link do Mídia Kit.',
      });
    } finally {
      setIsCopyingMediaKitLink(false);
    }
  }, [toast]);

  const handleShareMediaKitLink = useCallback(async () => {
    if (!mediaKitUrl) {
      toast({ variant: 'error', title: 'Link do mídia kit indisponível.' });
      return;
    }
    if (navigator?.share) {
      try {
        await navigator.share({ url: mediaKitUrl });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(mediaKitUrl);
      } else {
        const temp = document.createElement('textarea');
        temp.value = mediaKitUrl;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      toast({ variant: 'info', title: 'Link copiado. Compartilhe em qualquer app.' });
    } catch {
      toast({ variant: 'error', title: 'Não foi possível compartilhar. Copie manualmente.' });
    }
  }, [mediaKitUrl, toast]);

  const noData = !isLoading && proposals.length === 0;

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, proposalId: string) => {
      if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', proposalId);
        event.dataTransfer.effectAllowed = 'move';
      }
      setDraggedProposalId(proposalId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedProposalId(null);
    setDragOverStage(null);
  }, []);

  const handleDropOnStage = useCallback(
    async (stage: PipelineStageData, event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const dataId = event.dataTransfer?.getData('text/plain');
      const proposalId = dataId || draggedProposalId;
      if (!proposalId) return;
      const targetStatus = stage.dropStatus;
      const currentStatus = proposals.find((item) => item.id === proposalId)?.status;
      if (currentStatus === targetStatus) {
        setDraggedProposalId(null);
        setDragOverStage(null);
        return;
      }
      try {
        await updateProposalStatus(proposalId, targetStatus);
      } finally {
        setDraggedProposalId(null);
        setDragOverStage(null);
      }
    },
    [draggedProposalId, proposals, updateProposalStatus]
  );

  const handleMoveViaSelect = useCallback(
    (proposalId: string, stageKey: PipelineStageKey) => {
      const targetStage = PIPELINE_STAGES.find((stage) => stage.key === stageKey);
      if (!targetStage) return;
      updateProposalStatus(proposalId, targetStage.dropStatus);
    },
    [updateProposalStatus]
  );

  const scrollPipeline = useCallback(
    (direction: 'prev' | 'next') => {
      const container = pipelineCarouselRef.current;
      if (!container) return;
      const child = container.firstElementChild as HTMLElement | null;
      const childWidth = child ? child.offsetWidth : container.clientWidth * 0.9;
      const scrollDistance = childWidth + PIPELINE_GAP_PX;
      container.scrollBy({
        left: direction === 'next' ? scrollDistance : -scrollDistance,
        behavior: 'smooth',
      });
    },
    []
  );

  const scrollPipelineTo = useCallback((index: number) => {
    const container = pipelineCarouselRef.current;
    if (!container) return;
    const child = container.firstElementChild as HTMLElement | null;
    const childWidth = child ? child.offsetWidth : container.clientWidth * 0.9;
    const scrollDistance = index * (childWidth + PIPELINE_GAP_PX);
    container.scrollTo({ left: scrollDistance, behavior: 'smooth' });
  }, []);

  const handleProposalSelect = useCallback(
    (proposalId: string, enableAutoScroll = false) => {
      setSelectedId(proposalId);
      if (enableAutoScroll && typeof window !== 'undefined' && window.innerWidth < 768) {
        pendingScrollToDetailsRef.current = true;
      }
    },
    [setSelectedId]
  );

  useEffect(() => {
    if (!pendingScrollToDetailsRef.current) return;
    if (!selectedProposal || !selectedId || selectedProposal.id !== selectedId) return;
    pendingScrollToDetailsRef.current = false;
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      detailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        detailsHeadingRef.current?.focus({ preventScroll: true });
      }, 300);
    });
  }, [selectedId, selectedProposal]);

  useEffect(() => {
    const container = pipelineCarouselRef.current;
    if (!container || typeof window === 'undefined') return;

    container.scrollLeft = 0;
    setPipelinePage(0);

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    if (mediaQuery.matches) {
      return;
    }

    const handleScroll = () => {
      const child = container.firstElementChild as HTMLElement | null;
      if (!child) {
        setPipelinePage(0);
        return;
      }
      const step = child.offsetWidth + PIPELINE_GAP_PX;
      if (step <= 0) return;
      const rawIndex = Math.round(container.scrollLeft / step);
      const maxIndex = Math.max(0, totalPipelineStages - 1);
      const nextIndex = Math.min(Math.max(rawIndex, 0), maxIndex);
      setPipelinePage((prev) => (prev === nextIndex ? prev : nextIndex));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [totalPipelineStages]);

  return (
    <>
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-8">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
                  <Inbox className="h-4 w-4" />
                  Campanhas
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Central de propostas</h1>
                <p className="text-sm text-gray-600">
                  Acompanhe mensagens de marcas, atualize o status e peça ajuda ao Mobi para negociar.
                </p>
                <p className="text-xs text-gray-500">
                  Assinantes PRO também recebem propostas enviadas direto pela plataforma quando o link do mídia kit está na bio.
                </p>
              </div>
              <button
                type="button"
                onClick={loadProposals}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
              </button>
            </header>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              {isMediaKitLoading ? (
                <div className="text-sm text-gray-500">Carregando link do mídia kit…</div>
              ) : mediaKitUrl ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Link do seu mídia kit
                    </p>
                    <p className="text-sm text-gray-600">
                      Coloque na bio do Instagram. Marcas enviam propostas por aqui.
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">{mediaKitUrl}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={handleCopyMediaKitLink}
                      disabled={isCopyingMediaKitLink}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-pink-300"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                      {isCopyingMediaKitLink ? 'Copiando…' : 'Copiar link'}
                    </button>
                    <button
                      type="button"
                      onClick={handleShareMediaKitLink}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 sm:ml-2"
                    >
                      Compartilhar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Conecte seu Instagram</p>
                    <p className="text-xs text-gray-500">
                      Gere o mídia kit para receber propostas diretamente pela bio.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/media-kit')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    Criar mídia kit
                  </button>
                </div>
              )}
            </section>

            <section className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className={`min-w-[70%] snap-center rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:min-w-0 ${
                    card.highlight ? 'ring-2 ring-pink-100' : ''
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pipeline financeiro</h2>
              <p className="text-sm text-gray-500">
                Distribuição minimalista por etapa para decidir onde focar.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Atualizado em tempo real
              </span>
              <div className="flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => scrollPipeline('prev')}
                  className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-gray-600 transition hover:border-gray-300 hover:bg-white"
                  aria-label="Visualizar etapa anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollPipeline('next')}
                  className="inline-flex items-center justify-center rounded-full border border-gray-200 p-2 text-gray-600 transition hover:border-gray-300 hover:bg-white"
                  aria-label="Visualizar próxima etapa"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div
            ref={pipelineCarouselRef}
            className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:pb-0 xl:grid-cols-4"
          >
            {pipelineStagesData.map((stage) => (
              <div
                key={stage.key}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragOverStage !== stage.key) {
                    setDragOverStage(stage.key);
                  }
                }}
                onDragLeave={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;
                  if (nextTarget && event.currentTarget.contains(nextTarget)) {
                    return;
                  }
                  setDragOverStage((prev) => (prev === stage.key ? null : prev));
                }}
                onDrop={(event) => handleDropOnStage(stage, event)}
                className={`flex min-w-[85%] snap-center flex-shrink-0 flex-col rounded-2xl border border-gray-200 bg-gradient-to-b ${
                  stage.tone
                } p-4 transition md:min-w-0 md:snap-start ${
                  dragOverStage === stage.key ? 'ring-2 ring-pink-200' : ''
                }`}
                role="list"
                aria-labelledby={`stage-${stage.key}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      id={`stage-${stage.key}`}
                      className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {stage.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {currencyFormatter(stage.currency).format(stage.amount)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-semibold text-gray-600">
                    {stage.count} {stage.count === 1 ? 'proposta' : 'propostas'}
                  </span>
                </div>
                <div className="mt-4 space-y-3" role="presentation">
                  {stage.items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-4 py-5 text-xs text-gray-400">
                      {stage.emptyLabel}
                    </p>
                  ) : (
                    stage.items.map((proposal) => (
                      <article
                        key={proposal.id}
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(event) => handleDragStart(event, proposal.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleProposalSelect(proposal.id, true)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleProposalSelect(proposal.id, true);
                          }
                        }}
                        className={`w-full rounded-xl border bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:shadow ${
                          selectedId === proposal.id
                            ? 'border-pink-300 ring-1 ring-pink-100'
                            : 'border-transparent'
                        }`}
                        aria-grabbed={draggedProposalId === proposal.id}
                      >
                        <div className="font-semibold text-gray-900">{proposal.brandName}</div>
                        <p className="text-xs text-gray-500">{proposal.campaignTitle}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">
                            {proposal.budget != null
                              ? currencyFormatter(proposal.currency).format(proposal.budget)
                              : '—'}
                          </span>
                          <span>{formatDate(proposal.createdAt)}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 sm:hidden">
                          <span>Mover estágio</span>
                          <select
                            className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600"
                            value={stage.key}
                            onChange={(event) =>
                              handleMoveViaSelect(proposal.id, event.target.value as PipelineStageKey)
                            }
                          >
                            {PIPELINE_STAGES.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
          {totalPipelineStages > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-2 md:hidden">
              {pipelineStagesData.map((stage, index) => (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => scrollPipelineTo(index)}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    pipelinePage === index ? 'bg-pink-500' : 'bg-gray-300'
                  }`}
                  aria-label={`Ir para etapa ${stage.label}`}
                />
              ))}
            </div>
          ) : null}
        </section>

        {noData ? (
          <section className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <Inbox className="h-4 w-4" />
                {emptyStates.campaigns.title}
              </span>
              <p className="text-sm text-slate-600">{emptyStates.campaigns.description}</p>
                    {mediaKitUrl ? (
                      <button
                        type="button"
                        onClick={handleCopyMediaKitLink}
                        disabled={isCopyingMediaKitLink}
                        className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-pink-400"
                      >
                        <ClipboardCopy className="h-4 w-4" />
                        {isCopyingMediaKitLink ? 'Copiando...' : emptyStates.campaigns.ctaLabel}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => router.push('/dashboard/media-kit')}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                      >
                        Criar mídia kit
                      </button>
                    )}
            </div>
          </section>
        ) : null}

        {!canInteract && !isBillingLoading ? (
          <section className="rounded-3xl border border-pink-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-pink-600">
                  <span aria-hidden>🤖</span>
                  Recurso exclusivo PRO
                </span>
                <h2 className="text-lg font-semibold text-gray-900">
                  Responda e negocie direto pela plataforma
                </h2>
                <p className="text-sm text-gray-600">
                  Diagnóstico do Mobi, resposta assistida e envio pela própria Data2Content ficam disponíveis assim que você ativa o plano PRO.
                </p>
              </div>
              <div className="flex w-full flex-col sm:w-auto sm:items-end">
                <button
                  type="button"
                  onClick={() => {
                    showUpgradeToast();
                    openPaywall('banner', 'reply_email', {
                      returnTo: buildReturnTo(),
                      proposalId: selectedProposal?.id ?? null,
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
                >
                  Desbloquear IA
                </button>
                <p className="mt-2 text-xs text-gray-500 text-left sm:text-right max-w-xs">
                  {upgradeSubtitle}
                </p>
              </div>
            </div>
          </section>
        ) : null}


        {selectedProposal ? (
          <section ref={detailsSectionRef} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Campanha</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2
                      ref={detailsHeadingRef}
                      tabIndex={-1}
                      className="text-2xl font-semibold text-gray-900 focus:outline-none"
                    >
                      {selectedProposal.campaignTitle}
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${STATUS_COLORS[selectedProposal.status]}`}
                    >
                      {STATUS_LABELS[selectedProposal.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="font-semibold text-gray-900">{selectedProposal.brandName}</span>
                    <span aria-hidden="true">•</span>
                    <span>Recebida em {formatDate(selectedProposal.createdAt)}</span>
                    {lastActionDate ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>Última ação {formatDate(lastActionDate)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-1 sm:text-right">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</span>
                  <select
                    value={selectedProposal.status}
                    onChange={(event) =>
                      updateProposalStatus(selectedProposal.id, event.target.value as ProposalStatus)
                    }
                    className="min-w-[180px] rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  >
                    {(['novo', 'visto', 'respondido', 'aceito', 'rejeitado'] as ProposalStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {summaryTiles.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {summaryTiles.map((tile) => (
                    <div key={tile.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tile.label}</p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">{tile.value}</p>
                      {tile.helper ? <p className="text-xs text-gray-500">{tile.helper}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedProposal.originIp ? (
                <p className="text-xs text-gray-400">
                  Origem: {selectedProposal.originIp}
                  {selectedProposal.userAgent ? ` • ${selectedProposal.userAgent}` : ''}
                </p>
              ) : null}

              <details className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-700" role="group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-gray-900">
                  Briefing e referências
                  <span className="text-xs font-normal text-gray-400">
                    {deliverablesCount ? `${deliverablesCount} entregável${deliverablesCount > 1 ? 's' : ''}` : 'Sem entregáveis'}
                    {' · '}
                    {referenceLinksCount
                      ? `${referenceLinksCount} link${referenceLinksCount > 1 ? 's' : ''}`
                      : 'Sem links'}
                  </span>
                </summary>
                <div className="mt-3 space-y-4">
                  <p className="whitespace-pre-line rounded-xl border border-gray-50 bg-gray-50 p-3 text-gray-700">
                    {selectedProposal.campaignDescription || 'A marca não enviou briefing detalhado.'}
                  </p>
                  {selectedProposal.deliverables.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Entregáveis detalhados</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedProposal.deliverables.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {selectedProposal.referenceLinks.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Links de referência</p>
                      <ul className="mt-2 space-y-2">
                        {selectedProposal.referenceLinks.map((link) => (
                          <li key={link}>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-medium text-[#6E1F93] hover:underline"
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Assistente IA</p>
                  <p className="text-xs text-gray-500">Peça um diagnóstico rápido antes de responder.</p>
                </div>
                <button
                  ref={analyzeButtonRef}
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analysisLoading}
                  className={
                    !canInteract && !isBillingLoading
                      ? 'mt-3 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-500 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 sm:mt-0'
                      : 'mt-3 inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-500 sm:mt-0'
                  }
                  title={!canInteract && !isBillingLoading ? tooltipAnalyzePro : undefined}
                  aria-disabled={analysisLoading || !canInteract}
                >
                  {canInteract ? (
                    <MessageSquare className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {canInteract
                    ? analysisLoading
                      ? 'Consultando Mobi...'
                      : 'Analisar com IA'
                    : 'Analisar com IA (PRO)'}
                </button>
              </div>

              {analysisMessage && canInteract ? (
                <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 text-sm text-pink-900 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    <span className="font-semibold">Diagnóstico do Mobi</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line leading-relaxed">{analysisMessage}</p>
                </div>
              ) : null}

              <div className="h-px w-full bg-gray-100" />

              {canInteract ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-gray-900">Responder com IA</span>
                      <p className="text-xs text-gray-400">
                        Enviaremos para {selectedProposal.contactEmail} com cabeçalho Data2Content.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleRefreshReply}
                        disabled={replyRegenerating}
                        className="inline-flex items-center gap-2 rounded-full border border-pink-200 px-3 py-1.5 text-xs font-semibold text-pink-600 transition hover:border-pink-400 hover:bg-pink-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        {replyRegenerating ? 'Gerando...' : 'Nova sugestão'}
                      </button>
                      <button
                        ref={sendReplyButtonRef}
                        type="button"
                        onClick={handleSendReply}
                        disabled={replySending || !replyDraft.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-pink-300"
                      >
                        <Send className="h-4 w-4" />
                        {replySending ? 'Enviando...' : 'Enviar resposta'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={replyTextareaRef}
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    rows={5}
                    placeholder="Oi, tudo bem? Recebi a proposta e posso te ajudar com…"
                    className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100"
                  />
                  <div className="mt-2 flex flex-col gap-2 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                    {selectedProposal.lastResponseAt ? (
                      <span>Última resposta enviada em {formatDate(selectedProposal.lastResponseAt)}</span>
                    ) : (
                      <span>Pronto para enviar em 1 clique.</span>
                    )}
                    <span>{replyDraft.length} caracteres</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <Lock className="h-4 w-4 text-gray-500" />
                      Responder com IA (PRO)
                    </div>
                    {selectedProposal.lastResponseAt ? (
                      <span className="text-xs text-gray-500">
                        Última resposta enviada em {formatDate(selectedProposal.lastResponseAt)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Assine o PRO para liberar texto sugerido e envio direto para {selectedProposal.contactEmail}.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      openPaywall('reply_cta', 'reply_email', {
                        returnTo: buildReturnTo(selectedProposal.id),
                        proposalId: selectedProposal.id,
                      })
                    }
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700"
                  >
                    Desbloquear resposta com IA
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : detailLoading ? (
          <section className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
            Carregando detalhes da proposta...
          </section>
        ) : null}

        <footer className="pt-6 text-sm text-gray-400">
          Precisa atualizar suas métricas antes de responder?{' '}
          <button
            type="button"
            onClick={() => router.push('/dashboard/calculator')}
            className="font-semibold text-pink-600 underline-offset-4 hover:underline"
          >
            Abra a Calculadora de Publi
          </button>
        </footer>
        </div>
      </div>
    </>
  );
}
