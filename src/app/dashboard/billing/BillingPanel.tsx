'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { buildCheckoutUrl } from '@/app/lib/checkoutRedirect';
import CancelSubscriptionModal from '@/components/billing/CancelSubscriptionModal';

type PlanStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'canceled'
  | 'inactive'
  | 'non_renewing'
  | 'expired'
  | 'pending';

export type BillingStatus = {
  planStatus: PlanStatus | null;
  planInterval: 'month' | 'year' | null;
  planExpiresAt: string | null;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  lastPaymentError?: string | null;
};

export default function BillingPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<BillingStatus | null>(null);
  const [doing, setDoing] = useState<'cancel' | 'reactivate' | 'portal' | 'abort' | 'resume' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const resyncRef = useRef(false);

  const notifyBillingRefresh = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('billing-status-refresh'));
  }, []);

  const fetchStatus = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/status', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message ?? 'Falha ao carregar status';
        toast.error(msg);
        setError(msg);
        setS(null);
        return;
      }
      setS(data);
    } catch (err: any) {
      const msg = err?.message || 'Não foi possível carregar as informações do plano.';
      toast.error(msg);
      setError(msg);
      setS(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!s || resyncRef.current) return;
    if (s.planStatus !== 'non_renewing' || !s.planExpiresAt) return;
    const expiresAt = new Date(s.planExpiresAt);
    if (Number.isNaN(expiresAt.getTime())) return;
    if (expiresAt.getTime() > Date.now()) return;
    resyncRef.current = true;
    (async () => {
      try {
        await fetch('/api/billing/subscription', { cache: 'no-store' });
      } finally {
        fetchStatus();
      }
    })();
  }, [s, fetchStatus]);

  const openPortal = async (): Promise<void> => {
    setDoing('portal');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message ?? 'Falha ao abrir portal');
        return;
      }
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao abrir portal');
    } finally {
      setDoing(null);
    }
  };

  const resumeCheckout = async (): Promise<void> => {
    setDoing('resume');
    try {
      const res = await fetch('/api/billing/resume', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.code;
        if (code === 'SUBSCRIPTION_INCOMPLETE_EXPIRED') {
          toast.error(data?.message ?? 'Tentativa expirada. Voce pode iniciar um novo checkout.');
          await fetchStatus();
          return;
        }
        if (code === 'PAYMENT_ISSUE') {
          toast.error(data?.message ?? 'Pagamento pendente. Atualize o método de pagamento no portal.');
          await fetchStatus();
          return;
        }
        if (code === 'SUBSCRIPTION_ACTIVE') {
          toast.success(data?.message ?? 'Assinatura já está ativa.');
          await fetchStatus();
          return;
        }
        if (code === 'BILLING_RESUME_NOT_PENDING') {
          toast.error(data?.message ?? 'Não há checkout pendente para retomar.');
          await fetchStatus();
          return;
        }
        toast.error(data?.message ?? 'Falha ao retomar o checkout.');
        return;
      }
      if (!data?.clientSecret) {
        toast.error('Não foi possível retomar o pagamento. Tente novamente.');
        return;
      }
      router.push(buildCheckoutUrl(data.clientSecret, data.subscriptionId));
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao retomar o checkout.');
    } finally {
      setDoing(null);
    }
  };

  const cancelWithReason = async ({
    reasons,
    comment,
  }: {
    reasons: string[];
    comment: string;
  }): Promise<void> => {
    setDoing('cancel');
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasons, comment }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message ?? 'Falha ao cancelar');
        return;
      }
      toast.success('Cancelamento agendado.');
      await fetchStatus();
      notifyBillingRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao cancelar');
    } finally {
      setDoing(null);
    }
  };

  const reactivate = async (): Promise<void> => {
    setDoing('reactivate');
    try {
      const res = await fetch('/api/billing/reactivate', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.code;
        if (code === 'NOT_REACTIVATABLE_USE_SUBSCRIBE') {
          toast.error(data?.message ?? 'Assinatura cancelada definitivamente. Assine novamente.');
          await fetchStatus();
          return;
        }
        if (code === 'NOT_REACTIVATABLE_NOT_CANCELING') {
          toast.error(data?.message ?? 'Assinatura já está ativa e sem cancelamento agendado.');
          await fetchStatus();
          return;
        }
        if (code === 'NOT_REACTIVATABLE_STATUS') {
          toast.error(data?.message ?? 'Assinatura não está ativa para reativação.');
          await fetchStatus();
          return;
        }
        toast.error(data?.message ?? 'Falha ao reativar');
        return;
      }
      toast.success('Assinatura reativada.');
      await fetchStatus();
      notifyBillingRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível reativar a assinatura.');
    } finally {
      setDoing(null);
    }
  };

  const abortPending = async (): Promise<void> => {
    const ok = confirm('Abortar tentativa pendente? Isso libera um novo checkout.');
    if (!ok) return;
    setDoing('abort');
    try {
      const res = await fetch('/api/billing/abort', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message ?? data?.error ?? 'Falha ao abortar tentativa');
        return;
      }
      toast.success('Tentativa cancelada. Você pode assinar novamente.');
      await fetchStatus();
      notifyBillingRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao abortar tentativa');
    } finally {
      setDoing(null);
    }
  };

  if (loading && !s && !error) return <div className="text-sm text-muted-foreground">Carregando informações do plano…</div>;

  if (error) {
    return (
      <div className="space-y-4 rounded-2xl border p-4 md:p-6">
        <div className="text-sm text-muted-foreground">{error}</div>
        <button
          onClick={fetchStatus}
          className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!s) return null;

  const fmt = (d?: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '-');
  const status: PlanStatus = s.planStatus ?? 'inactive';
  const intervalLabel = s.planInterval === 'year' ? 'Anual' : s.planInterval === 'month' ? 'Mensal' : null;
  const cancelable = (status === 'active' || status === 'trialing') && !s.cancelAtPeriodEnd;
  const canReactivate = status === 'non_renewing' && s.cancelAtPeriodEnd === true;
  const portalBlockedStatuses: PlanStatus[] = ['pending', 'expired', 'incomplete', 'incomplete_expired'];
  const showPortal = (status === 'active' || status === 'non_renewing' || status === 'trialing' || status === 'past_due' || status === 'unpaid') && !portalBlockedStatuses.includes(status);
  const canResumeCheckout = status === 'pending' || status === 'incomplete';
  const needsCheckout = ['pending', 'incomplete'].includes(status);
  const showSubscribeCta =
    status === 'inactive' || status === 'canceled' || status === 'expired' || status === 'incomplete_expired';

  let statusDescription: React.ReactNode = <>Status indisponível.</>;
  switch (status) {
    case 'active':
      statusDescription = <>Ativo {intervalLabel ? `(${intervalLabel}) ` : ''}• renova em {fmt(s.planExpiresAt)}</>;
      break;
    case 'trialing':
      statusDescription = <>Período de teste {intervalLabel ? `(${intervalLabel}) ` : ''}• expira em {fmt(s.planExpiresAt)}</>;
      break;
    case 'non_renewing':
      statusDescription = <>Cancelado ao fim do período • acesso até {fmt(s.cancelAt ?? s.planExpiresAt)}</>;
      break;
    case 'past_due':
    case 'unpaid':
      statusDescription = <>Cartão recusado • atualize seu método de pagamento.</>;
      break;
    case 'incomplete':
      statusDescription = <>Pagamento não finalizado • conclua o checkout para ativar.</>;
      break;
    case 'incomplete_expired':
      statusDescription = <>Tentativa expirada • você pode iniciar um novo checkout.</>;
      break;
    case 'pending':
      statusDescription = <>Processando ativação • finalize o checkout para liberar o acesso.</>;
      break;
    case 'canceled':
      statusDescription = <>Assinatura cancelada • último acesso em {fmt(s.cancelAt ?? s.planExpiresAt)}</>;
      break;
    case 'expired':
      statusDescription = <>Teste expirado • contrate o Plano Agência para continuar.</>;
      break;
    case 'inactive':
    default:
      statusDescription = <>Nenhum plano ativo no momento.</>;
      break;
  }

  return (
    <div className="space-y-4 rounded-2xl border p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold">Seu plano</div>
          <div className="text-sm text-muted-foreground">{statusDescription}</div>
          {typeof s.lastPaymentError === 'string' && s.lastPaymentError && (
            <div className="mt-2 text-xs text-amber-600">
              Último erro de pagamento: {s.lastPaymentError}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {cancelable && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              disabled={doing === 'cancel'}
              className="px-3 py-2 rounded-lg border hover:bg-muted"
            >
              {doing === 'cancel' ? 'Cancelando…' : 'Cancelar plano'}
            </button>
          )}
          {canReactivate && (
            <button type="button" onClick={reactivate} disabled={doing === 'reactivate'} className="px-3 py-2 rounded-lg border hover:bg-muted">
              {doing === 'reactivate' ? 'Reativando…' : 'Reativar'}
            </button>
          )}
          {showPortal && (
            <button type="button" onClick={openPortal} disabled={doing === 'portal'} className="px-3 py-2 rounded-lg border hover:bg-muted">
              {doing === 'portal'
                ? 'Abrindo…'
                : status === 'past_due' || status === 'unpaid'
                  ? 'Atualizar pagamento'
                  : 'Gerenciar pagamento'}
            </button>
          )}
        </div>
      </div>

      {(needsCheckout || showSubscribeCta) && (
        <div className="flex flex-col gap-2 text-sm">
          {needsCheckout && (
            <>
              {canResumeCheckout && (
                <button
                  type="button"
                  onClick={resumeCheckout}
                  disabled={doing === 'resume'}
                  className="inline-flex items-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  {doing === 'resume' ? 'Continuando…' : 'Continuar checkout'}
                </button>
              )}
              <button
                type="button"
                onClick={abortPending}
                disabled={doing === 'abort'}
                className="inline-flex items-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {doing === 'abort' ? 'Abortando…' : 'Abortar tentativa'}
              </button>
            </>
          )}
          {showSubscribeCta && (
            <a href="/dashboard/billing/checkout" className="inline-flex items-center px-3 py-2 rounded-lg bg-black text-white hover:opacity-90">
              {status === 'canceled' ? 'Assinar novamente' : 'Assinar agora'}
            </a>
          )}
        </div>
      )}

      {s && (
        <CancelSubscriptionModal
          open={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={(data) => {
            cancelWithReason(data);
            setShowCancelModal(false);
          }}
          currentPeriodEnd={s.planExpiresAt}
        />
      )}
    </div>
  );
}
