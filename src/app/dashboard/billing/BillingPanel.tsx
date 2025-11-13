'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

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
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<BillingStatus | null>(null);
  const [doing, setDoing] = useState<'cancel' | 'reactivate' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const openPortal = async (): Promise<void> => {
    setDoing('portal');
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await res.json();
    setDoing(null);
    if (!res.ok) {
      toast.error(data?.message ?? 'Falha ao abrir portal');
      return;
    }
    window.location.href = data.url;
  };

  const cancelAtPeriodEnd = async (): Promise<void> => {
    const ok = confirm('Cancelar ao fim do período? Você continuará com acesso até a data de renovação.');
    if (!ok) return;
    setDoing('cancel');
    const res = await fetch('/api/billing/cancel', { method: 'POST' });
    const data = await res.json();
    setDoing(null);
    if (!res.ok) {
      toast.error(data?.message ?? 'Falha ao cancelar');
      return;
    }
    toast.success('Cancelamento agendado.');
    await fetchStatus();
  };

  const reactivate = async (): Promise<void> => {
    setDoing('reactivate');
    const res = await fetch('/api/billing/reactivate', { method: 'POST' });
    const data = await res.json();
    setDoing(null);
    if (!res.ok) {
      toast.error(data?.message ?? 'Falha ao reativar');
      return;
    }
    toast.success('Assinatura reativada.');
    await fetchStatus();
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
  const canReactivate = s.cancelAtPeriodEnd || status === 'non_renewing';
  const portalBlockedStatuses: PlanStatus[] = ['pending', 'expired', 'incomplete', 'incomplete_expired'];
  const showPortal = (status === 'active' || status === 'non_renewing' || status === 'trialing' || status === 'past_due' || status === 'unpaid') && !portalBlockedStatuses.includes(status);
  const needsCheckout = ['pending', 'incomplete', 'incomplete_expired'].includes(status);
  const showSubscribeCta = status === 'inactive' || status === 'canceled' || status === 'expired';

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
      statusDescription = <>Pagamento pendente • atualize seu método de pagamento.</>;
      break;
    case 'incomplete':
      statusDescription = <>Pagamento não finalizado • conclua o checkout para ativar.</>;
      break;
    case 'incomplete_expired':
      statusDescription = <>Tentativa de pagamento expirada • inicie um novo checkout.</>;
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
            <button onClick={cancelAtPeriodEnd} disabled={doing === 'cancel'} className="px-3 py-2 rounded-lg border hover:bg-muted">
              {doing === 'cancel' ? 'Cancelando…' : 'Cancelar plano'}
            </button>
          )}
          {canReactivate && (
            <button onClick={reactivate} disabled={doing === 'reactivate'} className="px-3 py-2 rounded-lg border hover:bg-muted">
              {doing === 'reactivate' ? 'Reativando…' : 'Reativar'}
            </button>
          )}
          {showPortal && (
            <button onClick={openPortal} disabled={doing === 'portal'} className="px-3 py-2 rounded-lg border hover:bg-muted">
              {doing === 'portal' ? 'Abrindo…' : 'Gerenciar pagamento'}
            </button>
          )}
        </div>
      </div>

      {(needsCheckout || showSubscribeCta) && (
        <div className="flex flex-col gap-2 text-sm">
          {needsCheckout && (
            <a href="/dashboard/billing/checkout" className="inline-flex items-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted">
              Retomar pagamento
            </a>
          )}
          {showSubscribeCta && (
            <a href="/pricing" className="inline-flex items-center px-3 py-2 rounded-lg bg-black text-white hover:opacity-90">
              Assinar agora
            </a>
          )}
        </div>
      )}
    </div>
  );
}
