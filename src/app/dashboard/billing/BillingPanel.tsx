'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ChevronRight, CreditCard, RefreshCcw, XCircle } from 'lucide-react';
import { buildCheckoutUrl } from '@/app/lib/checkoutRedirect';
import CancelSubscriptionModal from '@/components/billing/CancelSubscriptionModal';
import { openPaywallModal } from '@/utils/paywallModal';

type PlanStatus =
  | 'active'
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

  if (loading && !s && !error) {
    return (
      <section className="ds-notebook-section animate-pulse" aria-label="Carregando assinatura">
        <div className="h-3 w-24 rounded bg-[var(--ds-color-neutral)]" />
        <div className="mt-4 h-7 w-40 rounded bg-[var(--ds-color-neutral)]" />
        <div className="mt-3 h-4 w-full max-w-sm rounded bg-[var(--ds-color-neutral)]" />
        <div className="mt-6 h-11 w-full rounded-lg bg-[var(--ds-color-neutral)]" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="ds-notebook-section py-10 text-center">
        <h2 className="font-display text-xl font-bold tracking-[-0.03em] text-[var(--ds-color-ink)]">Não foi possível abrir seu plano</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--ds-color-text-muted)]">{error}</p>
        <button
          type="button"
          onClick={fetchStatus}
          className="ds-button ds-button--secondary mt-5"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </section>
    );
  }

  if (!s) return null;

  const fmt = (d?: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '-');
  const status: PlanStatus = s.planStatus ?? 'inactive';
  const intervalLabel = s.planInterval === 'year' ? 'Anual' : s.planInterval === 'month' ? 'Mensal' : null;
  const cancelable = status === 'active' && !s.cancelAtPeriodEnd;
  const canReactivate = status === 'non_renewing' && s.cancelAtPeriodEnd === true;
  const portalBlockedStatuses: PlanStatus[] = ['pending', 'expired', 'incomplete', 'incomplete_expired'];
  const showPortal = (status === 'active' || status === 'non_renewing' || status === 'past_due' || status === 'unpaid') && !portalBlockedStatuses.includes(status);
  const canResumeCheckout = status === 'pending' || status === 'incomplete';
  const needsCheckout = ['pending', 'incomplete'].includes(status);
  const showSubscribeCta =
    status === 'inactive' || status === 'canceled' || status === 'expired' || status === 'incomplete_expired';
  const statusTone = status === 'active'
    ? 'ds-badge--success'
    : status === 'past_due' || status === 'unpaid' || status === 'incomplete' || status === 'pending'
      ? 'ds-badge--warning'
      : status === 'non_renewing'
        ? 'ds-badge--danger'
        : 'ds-badge--neutral';
  const statusLabel: Record<PlanStatus, string> = {
    active: 'Ativo',
    non_renewing: 'Cancelamento agendado',
    past_due: 'Pagamento pendente',
    unpaid: 'Pagamento pendente',
    incomplete: 'Checkout pendente',
    incomplete_expired: 'Checkout expirado',
    pending: 'Ativação pendente',
    canceled: 'Cancelado',
    expired: 'Expirado',
    inactive: 'Sem plano',
  };

  let statusDescription: React.ReactNode = <>Status indisponível.</>;
  switch (status) {
    case 'active':
      statusDescription = <>Ativo {intervalLabel ? `(${intervalLabel}) ` : ''}• renova em {fmt(s.planExpiresAt)}</>;
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
      statusDescription = <>Teste expirado • contrate o Plano Pro para continuar.</>;
      break;
    case 'inactive':
    default:
      statusDescription = <>Nenhum plano ativo no momento.</>;
      break;
  }

  return (
    <div className="space-y-3">
      <section className="ds-notebook-section ds-notebook-section--first">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="ds-notebook-label">Assinatura</p>
            <h2 className="mt-2 font-display text-[1.75rem] font-bold leading-none tracking-[-0.04em] text-[var(--ds-color-ink)]">
              {status === 'inactive' || status === 'expired' || status === 'canceled' ? 'Plano Free' : 'Plano Pro'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ds-color-text-secondary)]">{statusDescription}</p>
          {typeof s.lastPaymentError === 'string' && s.lastPaymentError && (
              <p className="ds-status-panel ds-status-panel--warning mt-4 text-xs leading-relaxed">
              Último erro de pagamento: {s.lastPaymentError}
              </p>
          )}
          </div>
          <span className={`ds-badge shrink-0 ${statusTone}`}>{statusLabel[status]}</span>
        </div>

      {(needsCheckout || showSubscribeCta || canReactivate) && (
          <div className="mt-6 space-y-2">
          {canReactivate ? (
            <button
              type="button"
              onClick={reactivate}
              disabled={doing === 'reactivate'}
              className="ds-button ds-button--primary ds-button--block"
            >
              {doing === 'reactivate' ? 'Reativando…' : 'Reativar assinatura'}
            </button>
          ) : null}
          {needsCheckout && (
            <>
              {canResumeCheckout && (
                <button
                  type="button"
                  onClick={resumeCheckout}
                  disabled={doing === 'resume'}
                    className="ds-button ds-button--primary ds-button--block"
                >
                  {doing === 'resume' ? 'Continuando…' : 'Continuar checkout'}
                </button>
              )}
            </>
          )}
          {showSubscribeCta && (
            <button
              type="button"
              onClick={() => openPaywallModal({
                context: 'narrative_map',
                source: 'billing_settings_subscribe',
                returnTo: '/dashboard/boards/mobile-strategic-profile',
              })}
              className="ds-button ds-button--primary ds-button--block"
            >
              {status === 'canceled' ? 'Assinar novamente' : 'Assinar agora'}
            </button>
          )}
          </div>
      )}
      </section>

      {(showPortal || canReactivate || canResumeCheckout || cancelable) && (
        <section className="ds-notebook-section !py-2">
          <p className="ds-notebook-label px-1 pb-1 pt-2">Gerenciar plano</p>
          {showPortal ? (
            <BillingSettingsAction
              label={doing === 'portal' ? 'Abrindo…' : status === 'past_due' || status === 'unpaid' ? 'Atualizar pagamento' : 'Gerenciar pagamento'}
              icon={<CreditCard className="h-4 w-4" strokeWidth={1.9} />}
              onClick={openPortal}
              disabled={doing === 'portal'}
            />
          ) : null}
          {canResumeCheckout ? (
            <BillingSettingsAction
              label={doing === 'abort' ? 'Abortando…' : 'Abortar tentativa pendente'}
              icon={<XCircle className="h-4 w-4" strokeWidth={1.9} />}
              onClick={abortPending}
              disabled={doing === 'abort'}
              danger
            />
          ) : null}
          {cancelable ? (
            <BillingSettingsAction
              label={doing === 'cancel' ? 'Cancelando…' : 'Cancelar renovação'}
              icon={<XCircle className="h-4 w-4" strokeWidth={1.9} />}
              onClick={() => setShowCancelModal(true)}
              disabled={doing === 'cancel'}
              danger
            />
          ) : null}
        </section>
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

function BillingSettingsAction({
  label,
  icon,
  onClick,
  disabled,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`ds-notebook-row disabled:opacity-50 ${danger ? 'text-[var(--ds-color-danger)]' : ''}`}
    >
      <span className={danger ? 'text-[var(--ds-color-danger)]' : 'text-[var(--ds-color-text-secondary)]'}>{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
      <ChevronRight className="h-4 w-4 text-[var(--ds-color-text-muted)]" strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
