'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export type BillingStatus = {
  planStatus: 'active' | 'trialing' | 'canceled' | 'inactive' | 'pending';
  planInterval: 'month' | 'year' | null;
  planExpiresAt: string | null;
  cancelAt: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  lastPaymentError?: { at: string; id: string; status: string; statusDetail?: string } | null;
};

export default function BillingPanel() {
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<BillingStatus | null>(null);
  const [doing, setDoing] = useState<'cancel' | 'reactivate' | 'portal' | null>(null);

  const fetchStatus = useCallback(async (): Promise<void> => {
    setLoading(true);
    const res = await fetch('/api/billing/status', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data?.message ?? 'Falha ao carregar status');
      setLoading(false);
      return;
    }
    setS(data);
    setLoading(false);
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

  if (loading || !s) return <div className="text-sm text-muted-foreground">Carregando informações do plano…</div>;

  const fmt = (d?: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '-');
  const isCanceledAtEnd = s.planStatus === 'canceled';
  const isTrialing = s.planStatus === 'trialing';
  const isActive = s.planStatus === 'active' || isTrialing;
  const isPending = s.planStatus === 'pending';
  const isInactive = s.planStatus === 'inactive';

  return (
    <div className="space-y-4 rounded-2xl border p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Seu plano</div>
          <div className="text-sm text-muted-foreground">
            {isTrialing && !isCanceledAtEnd && (
              <>Período de teste ({s.planInterval === 'year' ? 'Anual' : 'Mensal'}) • termina em {fmt(s.planExpiresAt)}</>
            )}
            {!isTrialing && isActive && !isCanceledAtEnd && (
              <>Ativo ({s.planInterval === 'year' ? 'Anual' : 'Mensal'}) • renova em {fmt(s.planExpiresAt)}</>
            )}
            {isCanceledAtEnd && <>Cancelado ao fim do período • acesso até {fmt(s.cancelAt)}</>}
            {isPending && <>Pagamento pendente • finalize no portal</>}
            {isInactive && <>Inativo • assine para continuar</>}
          </div>
          {!!s.lastPaymentError && (
            <div className="mt-2 text-xs text-amber-600">
              Último erro de pagamento: {s.lastPaymentError.statusDetail ?? s.lastPaymentError.status} ({fmt(s.lastPaymentError.at)})
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isActive && !isCanceledAtEnd && (
            <button onClick={cancelAtPeriodEnd} disabled={doing === 'cancel'} className="px-3 py-2 rounded-lg border hover:bg-muted">
              {doing === 'cancel' ? 'Cancelando…' : 'Cancelar plano'}
            </button>
          )}
          {isCanceledAtEnd && (
            <button onClick={reactivate} disabled={doing === 'reactivate'} className="px-3 py-2 rounded-lg border hover:bg-muted">
              {doing === 'reactivate' ? 'Reativando…' : 'Reativar'}
            </button>
          )}
          {(isActive || isCanceledAtEnd || isPending) && (
            <button onClick={openPortal} disabled={doing === 'portal'} className="px-3 py-2 rounded-lg border hover:bg-muted">
              {doing === 'portal' ? 'Abrindo…' : 'Gerenciar pagamento'}
            </button>
          )}
        </div>
      </div>

      {isInactive && (
        <div className="text-sm">
          <a href="/pricing" className="inline-flex items-center px-3 py-2 rounded-lg bg-black text-white hover:opacity-90">
            Assinar agora
          </a>
        </div>
      )}
    </div>
  );
}
