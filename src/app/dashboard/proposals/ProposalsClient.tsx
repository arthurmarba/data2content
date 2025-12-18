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
  MailOpen,
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
  const upgradeMessage = 'Responder pela plataforma faz parte do Plano Agência.';
  const upgradeSubtitle =
    'Ative o Plano Agência para enviar com IA em 1 clique e negociar com a faixa justa automática.';
  const tooltipAnalyzePro = 'Disponível no Plano Agência: análise com IA e faixa justa automática.';
  const showUpgradeToast = useCallback(() => {
    toast({
      variant: 'info',
      title: 'Recurso exclusivo do Plano Agência',
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
        helper: `${openStages.reduce((acc, stage) => acc + stage.count, 0)} propostas ativas`,
        highlight: openAmount > 0,
      },
      {
        label: 'Fechado',
        value: currencyFormatter(collectCurrency(wonStage?.items ?? [])).format(wonAmount),
        helper: `${wonStage?.count ?? 0} propostas aceitas`,
        highlight: wonAmount > 0,
      },
      {
        label: 'Perdido',
        value: currencyFormatter(collectCurrency(lostStage?.items ?? [])).format(lostAmount),
        helper: `${lostStage?.count ?? 0} propostas recusadas`,
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
      <div className="dashboard-page-shell space-y-8 py-8">
        <header className="flex items-center justify-between border-b border-gray-100 pb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Campanhas & Propostas</h1>
            <p className="text-sm text-slate-500">Gerencie suas negociações em andamento.</p>
          </div>
          <button
            type="button"
            onClick={loadProposals}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </header>




          <section className="space-y-6">
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
                  className={`flex min-w-[85%] snap-center flex-shrink-0 flex-col rounded-2xl border border-gray-200 bg-gradient-to-b ${stage.tone
                    } p-4 transition md:min-w-0 md:snap-start ${dragOverStage === stage.key ? 'ring-2 ring-pink-200' : ''
                    }`}
                  role="list"
                  aria-labelledby={`stage-${stage.key}`}
                >
                  <div className="mb-4 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${stage.key === 'incoming' ? 'bg-amber-100 text-amber-700' :
                            stage.key === 'negotiation' ? 'bg-blue-100 text-blue-700' :
                              stage.key === 'won' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-red-100 text-red-700'
                          }`}>
                          {stage.label}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                    {stage.amount > 0 && (
                      <span className="text-2xl font-bold text-slate-900">
                        {currencyFormatter(stage.currency).format(stage.amount)}
                      </span>
                    )}
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
                          className={`group w-full cursor-pointer rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${selectedId === proposal.id
                            ? 'border-pink-500 ring-1 ring-pink-500'
                            : 'border-slate-200 hover:border-pink-200'
                            }`}
                          aria-grabbed={draggedProposalId === proposal.id}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900 line-clamp-1">{proposal.brandName}</div>
                            {proposal.status === 'novo' && (
                              <span className="h-2 w-2 rounded-full bg-pink-500 ring-2 ring-white" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-1">{proposal.campaignTitle}</p>

                          <div className="mt-4 flex items-end justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Orçamento</span>
                              <span className="text-sm font-bold text-slate-900">
                                {proposal.budget != null
                                  ? currencyFormatter(proposal.currency).format(proposal.budget)
                                  : '—'}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400 group-hover:text-pink-500 transition-colors">
                              {formatDate(proposal.createdAt)}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] text-slate-400 sm:hidden">
                            <span>Mover para:</span>
                            <select
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 focus:border-pink-500 focus:outline-none"
                              value={stage.key}
                              onChange={(event) =>
                                handleMoveViaSelect(proposal.id, event.target.value as PipelineStageKey)
                              }
                              onClick={(e) => e.stopPropagation()}
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
                    className={`h-2.5 w-2.5 rounded-full transition ${pipelinePage === index ? 'bg-pink-500' : 'bg-gray-300'
                      }`}
                    aria-label={`Ir para etapa ${stage.label}`}
                  />
                ))}
              </div>
            ) : null}
          </section>

          {noData ? (
            <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                <MailOpen className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{emptyStates.campaigns.title}</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">{emptyStates.campaigns.description}</p>

              <div className="mt-8">
                {mediaKitUrl ? (
                  <button
                    type="button"
                    onClick={handleCopyMediaKitLink}
                    disabled={isCopyingMediaKitLink}
                    className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-pink-700 disabled:opacity-70"
                  >
                    <ClipboardCopy className="h-4 w-4" />
                    {isCopyingMediaKitLink ? 'Copiando...' : emptyStates.campaigns.ctaLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/media-kit')}
                    className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-pink-700"
                  >
                    Criar meu Mídia Kit
                  </button>
                )}
              </div>
            </section>
          ) : null}

          {!canInteract && !isBillingLoading ? (
            <section className="relative overflow-hidden rounded-3xl border border-pink-100 bg-gradient-to-br from-white to-pink-50/50 p-6 shadow-sm">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-700">
                    <span aria-hidden>✨</span>
                    Plano Agência
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">
                    Responda e negocie direto pela plataforma
                  </h2>
                  <p className="max-w-xl text-sm leading-relaxed text-slate-600">
                    Diagnóstico do Mobi, resposta assistida e envio pela própria Data2Content ficam disponíveis assim que você ativa o Plano Agência.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                  <button
                    type="button"
                    onClick={() => {
                      showUpgradeToast();
                      openPaywall('banner', 'reply_email', {
                        returnTo: buildReturnTo(),
                        proposalId: selectedProposal?.id ?? null,
                      });
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-pink-700"
                  >
                    Desbloquear IA
                  </button>
                  <p className="text-xs font-medium text-slate-400">
                    {upgradeSubtitle}
                  </p>
                </div>
              </div>
            </section>
          ) : null}


          {selectedProposal ? (
            <section ref={detailsSectionRef} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mx-auto w-full space-y-8">
                {/* Header */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="font-medium text-slate-900">{selectedProposal.brandName}</span>
                        <span>•</span>
                        <span>Recebida em {formatDate(selectedProposal.createdAt)}</span>
                      </div>
                      <h2
                        ref={detailsHeadingRef}
                        tabIndex={-1}
                        className="text-3xl font-bold text-slate-900 focus:outline-none"
                      >
                        {selectedProposal.campaignTitle}
                      </h2>
                    </div>
                  </div>

                  {/* Summary Tiles */}
                  {summaryTiles.length ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {summaryTiles.map((tile) => (
                        <div key={tile.key} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-slate-50">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tile.label}</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{tile.value}</p>
                          {tile.helper ? <p className="mt-1 text-[10px] text-slate-500">{tile.helper}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Actions Section (Moved Up) */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Status Card */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                      Status da Proposta
                    </label>
                    <select
                      value={selectedProposal.status}
                      onChange={(event) =>
                        updateProposalStatus(selectedProposal.id, event.target.value as ProposalStatus)
                      }
                      className={`w-full rounded-xl border-0 px-4 py-3 text-sm font-semibold ring-1 ring-inset focus:ring-2 focus:ring-inset ${selectedProposal.status === 'novo' ? 'bg-amber-50 text-amber-700 ring-amber-200 focus:ring-amber-300' :
                          selectedProposal.status === 'visto' ? 'bg-slate-50 text-slate-700 ring-slate-200 focus:ring-slate-300' :
                            selectedProposal.status === 'respondido' ? 'bg-sky-50 text-sky-700 ring-sky-200 focus:ring-sky-300' :
                              selectedProposal.status === 'aceito' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 focus:ring-emerald-300' :
                                'bg-red-50 text-red-700 ring-red-200 focus:ring-red-300'
                        }`}
                    >
                      {(['novo', 'visto', 'respondido', 'aceito', 'rejeitado'] as ProposalStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Actions / AI Status */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                      Assistente de Negociação
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {canInteract ? 'IA Ativa' : 'IA Bloqueada'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {canInteract ? 'Pronto para analisar e responder.' : 'Upgrade para desbloquear.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Briefing Section */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <h3 className="mb-6 text-lg font-semibold text-slate-900">Briefing da Campanha</h3>

                  <div className="space-y-8">
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Descrição / Objetivo</p>
                      <p className="whitespace-pre-line text-base leading-relaxed text-slate-700">
                        {selectedProposal.campaignDescription || 'A marca não enviou briefing detalhado.'}
                      </p>
                    </div>

                    {selectedProposal.deliverables.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Entregáveis Solicitados</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedProposal.deliverables.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center rounded-xl bg-pink-50 px-3 py-1.5 text-sm font-medium text-pink-700 ring-1 ring-inset ring-pink-100"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedProposal.referenceLinks.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Referências</p>
                        <ul className="space-y-2">
                          {selectedProposal.referenceLinks.map((link) => (
                            <li key={link}>
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-pink-600"
                              >
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition group-hover:bg-pink-100 group-hover:text-pink-600">
                                  <ClipboardCopy className="h-3 w-3" />
                                </span>
                                <span className="underline decoration-slate-200 underline-offset-4 transition group-hover:decoration-pink-300">
                                  {link}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Unified AI Workspace */}
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 text-pink-600">
                        <Send className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Área de Resposta</h3>
                        <p className="text-[10px] text-slate-500">Analise a proposta e gere uma resposta persuasiva</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Analysis Section */}
                    {!analysisMessage && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                        <p className="text-xs text-slate-500 mb-3">
                          Receba um diagnóstico do orçamento e uma sugestão de resposta persuasiva.
                        </p>
                        <button
                          ref={analyzeButtonRef}
                          type="button"
                          onClick={handleAnalyze}
                          disabled={analysisLoading}
                          className={
                            !canInteract && !isBillingLoading
                              ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50'
                              : 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-70'
                          }
                        >
                          {canInteract ? (
                            analysisLoading ? (
                              <>
                                <RefreshCcw className="h-4 w-4 animate-spin" />
                                Analisando...
                              </>
                            ) : (
                              <>
                                <MessageSquare className="h-4 w-4" />
                                Analisar Proposta
                              </>
                            )
                          ) : (
                            <>
                              <Lock className="h-4 w-4" />
                              Desbloquear Análise
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {analysisMessage && canInteract && (
                      <div className="rounded-xl bg-pink-50 p-4 text-sm text-pink-900">
                        <p className="font-semibold mb-1">Diagnóstico do Mobi:</p>
                        <p className="whitespace-pre-line leading-relaxed text-pink-800/90">{analysisMessage}</p>
                      </div>
                    )}

                    <div className="h-px bg-slate-100" />

                    {/* Reply Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Sua Resposta</label>
                        {canInteract && (
                          <button
                            type="button"
                            onClick={handleRefreshReply}
                            disabled={replyRegenerating}
                            className="text-[10px] font-semibold text-pink-600 hover:underline disabled:opacity-50"
                          >
                            {replyRegenerating ? 'Gerando...' : 'Gerar nova sugestão'}
                          </button>
                        )}
                      </div>

                      {canInteract ? (
                        <>
                          <textarea
                            ref={replyTextareaRef}
                            value={replyDraft}
                            onChange={(event) => setReplyDraft(event.target.value)}
                            rows={8}
                            placeholder="Escreva sua resposta ou use a IA para gerar..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-pink-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                          />
                          <div className="flex items-center justify-between gap-3 pt-2">
                            <span className="text-[10px] text-slate-400">
                              {selectedProposal.lastResponseAt
                                ? `Último envio: ${formatDate(selectedProposal.lastResponseAt)}`
                                : 'Nenhuma resposta enviada'}
                            </span>
                            <button
                              ref={sendReplyButtonRef}
                              type="button"
                              onClick={handleSendReply}
                              disabled={replySending || !replyDraft.trim()}
                              className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send className="h-3.5 w-3.5" />
                              {replySending ? 'Enviando...' : 'Enviar'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px]" />
                          <div className="relative z-10 flex flex-col items-center gap-3">
                            <Lock className="h-5 w-5 text-slate-400" />
                            <p className="text-sm text-slate-600">
                              Assine o Plano Agência para desbloquear respostas assistidas por IA.
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                openPaywall('reply_cta', 'reply_email', {
                                  returnTo: buildReturnTo(selectedProposal.id),
                                  proposalId: selectedProposal.id,
                                })
                              }
                              className="mt-1 inline-flex items-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-pink-700"
                            >
                              Quero Desbloquear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedProposal.originIp ? (
                  <p className="text-xs text-slate-300">
                    Metadados: {selectedProposal.originIp}
                    {selectedProposal.userAgent ? ` • ${selectedProposal.userAgent}` : ''}
                  </p>
                ) : null}
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
    </>
  );
}
