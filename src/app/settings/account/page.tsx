'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';
import useBillingStatus from '@/app/hooks/useBillingStatus';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  trialing: 'Teste ativo',
  trial: 'Teste ativo',
  non_renewing: 'Cancelamento agendado',
  past_due: 'Pagamento pendente',
  unpaid: 'Pagamento pendente',
  incomplete: 'Checkout pendente',
  incomplete_expired: 'Tentativa expirada',
  pending: 'Checkout pendente',
  canceled: 'Cancelado',
  expired: 'Teste expirado',
  inactive: 'Sem plano ativo',
  unknown: 'Indisponível',
};

export default function AccountSettingsPage() {
  const [action, setAction] = useState<null | 'cancel' | 'reactivate' | 'delete'>(null);
  const {
    isLoading: billingLoading,
    planStatus,
    cancelAtPeriodEnd,
    normalizedStatus,
    needsPaymentAction,
    needsPaymentUpdate,
    needsCheckout,
    needsAbort,
    hasPremiumAccess,
    refetch,
  } = useBillingStatus();

  const statusValue = (normalizedStatus ?? planStatus ?? 'inactive') as string;
  const statusLabel = billingLoading ? 'Carregando...' : (STATUS_LABELS[statusValue] ?? 'Indisponível');
  const isActiveLike = statusValue === 'active' || statusValue === 'trialing' || statusValue === 'trial';
  const isNonRenewing = statusValue === 'non_renewing' || (cancelAtPeriodEnd && isActiveLike);
  const canCancel = isActiveLike && !cancelAtPeriodEnd;
  const canReactivate = isNonRenewing;
  const canResubscribe = statusValue === 'inactive' || statusValue === 'expired' || statusValue === 'canceled';
  const canDelete = !billingLoading && !hasPremiumAccess && !needsPaymentAction && statusValue !== 'unknown';
  const isBusy = action !== null;
  const deleteBlockMessage = billingLoading
    ? 'Carregando status da assinatura...'
    : hasPremiumAccess
    ? 'Você possui uma assinatura ativa. Cancele antes de excluir a conta.'
    : needsPaymentAction
    ? 'Você possui pendências de cobrança. Resolva antes de excluir a conta.'
    : 'Não foi possível validar o status da assinatura.';

  let statusNote: string | null = null;
  if (needsPaymentUpdate) {
    statusNote = 'Pagamento pendente. Atualize sua cobrança para evitar bloqueio.';
  } else if (needsAbort) {
    statusNote = 'Tentativa expirada. Aborte a tentativa e inicie um novo checkout.';
  } else if (needsCheckout) {
    statusNote = 'Checkout pendente. Continue ou aborte a tentativa.';
  } else if (isNonRenewing) {
    statusNote = 'Cancelamento agendado. Você mantém acesso até o fim do período.';
  } else if (statusValue === 'canceled') {
    statusNote = 'Assinatura cancelada. Você pode assinar novamente quando quiser.';
  }

  async function handleDelete() {
    if (!canDelete || isBusy) return;
    if (!confirm('Tem certeza que deseja excluir sua conta? Essa ação é irreversível.')) return;
    setAction('delete');
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(()=>({}));
        alert(b?.error || 'Falha ao excluir');
      } else {
        await signOut({ callbackUrl: '/' });
        return;
      }
    } finally {
      setAction(null);
    }
  }

  async function handleCancelSubscription() {
    if (!canCancel || isBusy) return;
    const ok = confirm('Cancelar ao fim do período? Você continuará com acesso até a renovação.');
    if (!ok) return;
    setAction('cancel');
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error || 'Falha ao cancelar');
      alert('Cancelamento agendado.');
      await refetch();
    } catch (e:any) {
      alert(e.message);
    } finally {
      setAction(null);
    }
  }

  async function handleReactivateSubscription() {
    if (!canReactivate || isBusy) return;
    setAction('reactivate');
    try {
      const res = await fetch('/api/billing/reactivate', { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = b?.code;
        if (code === 'NOT_REACTIVATABLE_USE_SUBSCRIBE') {
          alert(b?.message || 'Assinatura cancelada definitivamente. Assine novamente.');
          await refetch();
        } else if (code === 'NOT_REACTIVATABLE_NOT_CANCELING') {
          alert(b?.message || 'Assinatura já está ativa e sem cancelamento agendado.');
          await refetch();
        } else if (code === 'NOT_REACTIVATABLE_STATUS') {
          alert(b?.message || 'Assinatura não está ativa para reativação.');
          await refetch();
        } else {
          alert(b?.message || 'Falha ao reativar.');
        }
        return;
      }
      alert('Assinatura reativada.');
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Não foi possível reativar a assinatura.');
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 text-lg font-semibold">Assinatura</h2>
        <p className="text-sm text-gray-600">Status atual: <b>{statusLabel}</b></p>
        {statusNote && <p className="mt-1 text-xs text-gray-500">{statusNote}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {canCancel && (
            <button
              className="rounded-xl border px-4 py-2"
              onClick={handleCancelSubscription}
              disabled={isBusy || billingLoading}
            >
              {action === 'cancel' ? 'Cancelando...' : 'Cancelar assinatura'}
            </button>
          )}
          {canReactivate && (
            <button
              className="rounded-xl border px-4 py-2"
              onClick={handleReactivateSubscription}
              disabled={isBusy || billingLoading}
            >
              {action === 'reactivate' ? 'Reativando...' : 'Reativar assinatura'}
            </button>
          )}
          {needsPaymentAction && (
            <a href="/dashboard/billing" className="rounded-xl border px-4 py-2">
              Resolver pendência
            </a>
          )}
          {canResubscribe && (
            <a href="/dashboard/billing/checkout" className="rounded-xl bg-black px-4 py-2 text-white">
              {statusValue === 'canceled' ? 'Assinar novamente' : 'Assinar agora'}
            </a>
          )}
          {!canCancel && !canReactivate && !needsPaymentAction && !canResubscribe && (
            <a href="/dashboard/billing" className="rounded-xl border px-4 py-2">
              Gerenciar assinatura
            </a>
          )}
        </div>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 text-lg font-semibold text-red-600">Excluir conta</h2>
        {!canDelete && (
          <div className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
            {deleteBlockMessage}
          </div>
        )}
        <button
          className={`mt-3 rounded-xl px-4 py-2 text-white ${canDelete? 'bg-red-600' : 'bg-red-300 cursor-not-allowed'}`}
          onClick={handleDelete}
          disabled={!canDelete || isBusy}
        >
          {action === 'delete' ? 'Excluindo...' : 'Excluir minha conta'}
        </button>
      </section>
    </div>
  );
}
