/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, RefreshCcw, Send, MessageSquare, ClipboardCopy, Lock } from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastA11yProvider';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import BillingSubscribeModal from '@/app/dashboard/billing/BillingSubscribeModal';
import { track } from '@/lib/track';
import { emptyStates } from '@/constants/emptyStates';
import type { PaywallContext } from '@/types/paywall';
import { PAYWALL_RETURN_STORAGE_KEY } from '@/types/paywall';

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

const STATUS_OPTIONS: { value: ProposalStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'novo', label: 'Novas' },
  { value: 'visto', label: 'Vistas' },
  { value: 'respondido', label: 'Respondidas' },
  { value: 'aceito', label: 'Aceitas' },
  { value: 'rejeitado', label: 'Rejeitadas' },
];

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
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'todos'>('todos');
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
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [paywallContext, setPaywallContext] = useState<PaywallContext>('reply_email');
  const [isCopyingMediaKitLink, setIsCopyingMediaKitLink] = useState(false);
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
  const aiUsedRef = useRef(false);
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
  const tooltipReplyPro = 'Disponível no PRO: responda em 1 clique com IA.';

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

      setPaywallContext(context);
      setShowBillingModal(true);

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
        try {
          window.dispatchEvent(
            new CustomEvent('open-subscribe-modal', {
              detail: { context, source, returnTo, proposalId },
            })
          );
        } catch {
          /* noop */
        }
      }
    },
    [billingStatus.normalizedStatus, billingStatus.planStatus]
  );

  const loadProposals = useCallback(async (status: ProposalStatus | 'todos') => {
    setIsLoading(true);
    try {
      const query = status !== 'todos' ? `?status=${status}` : '';
      const response = await fetch(`/api/proposals${query}`, { cache: 'no-store' });
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
    loadProposals(statusFilter);
  }, [loadProposals, statusFilter]);

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

  const summaryCards = useMemo(() => {
    const total = proposals.length;
    const newCount = proposals.filter((item) => item.status === 'novo').length;
    const accepted = proposals.filter((item) => item.status === 'aceito').length;
    return [
      { label: 'Total de propostas', value: total, highlight: false },
      { label: 'Novas', value: newCount, highlight: newCount > 0 },
      { label: 'Aceitas', value: accepted, highlight: false },
    ];
  }, [proposals]);

  const showEmptyState = !isLoading && proposals.length === 0;

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

  if (showEmptyState) {
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
              </div>
              <button
                type="button"
                onClick={() => loadProposals(statusFilter)}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>
            </header>

            <section className="grid gap-4 sm:grid-cols-3">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${
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

            <section className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <Inbox className="h-4 w-4" />
                  {emptyStates.campaigns.title}
                </span>
                <p className="text-sm text-slate-600">
                  {emptyStates.campaigns.description}
                </p>
                <button
                  type="button"
                  onClick={handleCopyMediaKitLink}
                  disabled={isCopyingMediaKitLink}
                  className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-pink-400"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {isCopyingMediaKitLink ? 'Copiando...' : emptyStates.campaigns.ctaLabel}
                </button>
              </div>
            </section>
          </div>
        </div>
        <BillingSubscribeModal open={showBillingModal} onClose={() => setShowBillingModal(false)} />
      </>
    );
  }

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
          </div>
          <button
            type="button"
            onClick={() => loadProposals(statusFilter)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${
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

        <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Filtrar:</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ProposalStatus | 'todos')}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-gray-500">
              Mostrando {proposals.length} {proposals.length === 1 ? 'proposta' : 'propostas'}.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3">Campanha</th>
                  <th className="px-4 py-3">Orçamento</th>
                  <th className="px-4 py-3">Recebida em</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  Carregando propostas...
                </td>
              </tr>
            ) : (
              proposals.map((proposal) => {
                    const budgetDisplay =
                      proposal.budget != null
                        ? currencyFormatter(proposal.currency).format(proposal.budget)
                        : '—';
                    return (
                      <tr
                        key={proposal.id}
                        className={selectedId === proposal.id ? 'bg-pink-50/40' : ''}
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900">{proposal.brandName}</td>
                        <td className="px-4 py-3">{proposal.campaignTitle}</td>
                        <td className="px-4 py-3">{budgetDisplay}</td>
                        <td className="px-4 py-3">{formatDate(proposal.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[proposal.status]}`}
                          >
                            {STATUS_LABELS[proposal.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedId(proposal.id)}
                            className={
                              canInteract
                                ? 'inline-flex items-center gap-2 rounded-full border border-pink-200 px-3 py-1.5 text-xs font-semibold text-pink-600 transition hover:border-pink-400 hover:bg-pink-50'
                                : 'inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 transition hover:border-gray-300 hover:bg-gray-50'
                            }
                          >
                            {!canInteract ? <Lock className="h-3.5 w-3.5" /> : null}
                            {canInteract ? 'Ver detalhes' : 'Responder com IA (PRO)'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedProposal ? (
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedProposal.campaignTitle}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedProposal.brandName} • Recebida em {formatDate(selectedProposal.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                value={selectedProposal.status}
                onChange={(event) =>
                    updateProposalStatus(selectedProposal.id, event.target.value as ProposalStatus)
                }
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            >
                  {(['novo', 'visto', 'respondido', 'aceito', 'rejeitado'] as ProposalStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
            </select>
                <button
                  ref={analyzeButtonRef}
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analysisLoading}
                  className={
                    !canInteract && !isBillingLoading
                      ? 'inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-500 shadow-sm transition hover:border-gray-400 hover:bg-gray-50'
                      : 'inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-500'
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
            </div>

            {!canInteract && !isBillingLoading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-pink-200 bg-pink-50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 text-pink-900">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <Lock className="h-3.5 w-3.5" />
                      PRO exclusivo
                    </div>
                    <h3 className="text-base font-semibold">Responder pela plataforma é PRO.</h3>
                    <p className="text-sm text-pink-800">
                      E-mail pronto com 1 clique e faixa justa sugerida pela IA, direto nesta tela.
                    </p>
                  </div>
                      <button
                        type="button"
                        onClick={() =>
                          openPaywall('detail_primary_cta', 'reply_email', {
                            returnTo: buildReturnTo(selectedProposal.id),
                            proposalId: selectedProposal.id,
                          })
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
                        title={tooltipReplyPro}
                      >
                    Ativar PRO para responder agora
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Contato da marca</h3>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">E-mail:</span> {selectedProposal.contactEmail}
                </p>
                {selectedProposal.contactWhatsapp ? (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">WhatsApp:</span> {selectedProposal.contactWhatsapp}
                  </p>
                ) : null}
                {selectedProposal.originIp ? (
                  <p className="text-xs text-gray-400">
                    IP: {selectedProposal.originIp} {selectedProposal.userAgent ? `• ${selectedProposal.userAgent}` : ''}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Oferta financeira</h3>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Orçamento:</span>{' '}
                  {selectedProposal.budget != null
                    ? currencyFormatter(selectedProposal.currency).format(selectedProposal.budget)
                    : 'Não informado'}
                </p>
                <p className="text-xs text-gray-400">
                  Atualizado em {formatDate(selectedProposal.updatedAt)}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Briefing enviado</h3>
                <p className="mt-2 whitespace-pre-line rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-700 shadow-sm">
                  {selectedProposal.campaignDescription || 'A marca não enviou briefing detalhado.'}
                </p>
              </div>
              {selectedProposal.deliverables.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Entregáveis desejados</h3>
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
                  <h3 className="text-sm font-semibold text-gray-800">Links de referência</h3>
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

            <div className="mt-6 space-y-4">
              {analysisMessage && canInteract ? (
                <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 text-sm text-pink-900 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    <span className="font-semibold">Diagnóstico do Mobi</span>
                    <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-600">
                      PRO
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line leading-relaxed">{analysisMessage}</p>
                </div>
              ) : null}
              {canInteract ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div
                        className="flex items-center gap-2 text-sm font-semibold text-gray-800"
                        title={tooltipReplyPro}
                      >
                        <MessageSquare className="h-4 w-4 text-pink-600" />
                        Responder com IA
                        <span className="inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-700">
                          PRO
                        </span>
                      </div>
                      {selectedProposal.lastResponseAt ? (
                        <span className="text-xs text-gray-500">
                          Última resposta enviada em {formatDate(selectedProposal.lastResponseAt)}
                        </span>
                      ) : null}
                    </div>
                  <textarea
                    ref={replyTextareaRef}
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                      rows={6}
                      placeholder="Oi, pessoal da marca! Tudo bem? Vi a proposta e adorei a ideia da campanha..."
                      className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100"
                    />
                    <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <p className="text-xs text-gray-400 leading-relaxed">
                        O e-mail será enviado para {selectedProposal.contactEmail} com o cabeçalho Data2Content e um resumo da proposta (marca, campanha, orçamento e entregáveis).
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={handleRefreshReply}
                          disabled={replyRegenerating}
                          className="inline-flex items-center gap-2 rounded-full border border-pink-200 px-4 py-2 text-sm font-semibold text-pink-600 shadow-sm transition hover:border-pink-400 hover:bg-pink-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                          title={!canInteract ? tooltipReplyPro : undefined}
                          aria-disabled={replyRegenerating}
                        >
                          <RefreshCcw className="h-4 w-4" />
                          {replyRegenerating ? 'Gerando...' : 'Gerar nova sugestão'}
                        </button>
                      <button
                        ref={sendReplyButtonRef}
                        type="button"
                        onClick={handleSendReply}
                          disabled={replySending || !replyDraft.trim()}
                          className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-pink-300"
                          title={!canInteract ? tooltipReplyPro : undefined}
                          aria-disabled={replySending || !replyDraft.trim()}
                        >
                          <Send className="h-4 w-4" />
                          {replySending ? 'Enviando...' : 'Enviar resposta à marca'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Lock className="h-4 w-4 text-gray-500" />
                        Responder com IA
                        <span className="inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-700">
                          PRO
                        </span>
                      </div>
                      {selectedProposal.lastResponseAt ? (
                        <span className="text-xs text-gray-500">
                          Última resposta enviada em {formatDate(selectedProposal.lastResponseAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      Ative o PRO para liberar o texto sugerido pela IA e o envio direto para {selectedProposal.contactEmail}.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Inclui faixa justa automática e templates atualizados pelo Mobi.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          openPaywall('reply_cta', 'reply_email', {
                            returnTo: buildReturnTo(selectedProposal.id),
                            proposalId: selectedProposal.id,
                          })
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
                      >
                        Responder com IA (PRO)
                      </button>
                    </div>
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
      <BillingSubscribeModal
        open={showBillingModal}
        onClose={() => setShowBillingModal(false)}
        context={paywallContext}
      />
    </>
  );
}
