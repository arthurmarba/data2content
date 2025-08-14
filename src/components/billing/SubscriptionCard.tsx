import { useState } from 'react';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import ReactivateBanner from './ReactivateBanner';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonRow from '@/components/ui/SkeletonRow';
import ErrorState from '@/components/ui/ErrorState';

export default function SubscriptionCard() {
  const { subscription, error, isLoading, refresh } = useSubscription();
  const { update: updateSession } = useSession();
  const [showModal, setShowModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  if (isLoading) return <SkeletonRow />;
  if (error) return <ErrorState message="Erro ao carregar assinatura." />;
  if (!subscription) return <EmptyState text="Você ainda não tem assinatura" />;

  const nextDate = new Date(subscription.nextInvoiceDate).toLocaleDateString();
  const amount = (subscription.nextInvoiceAmountCents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: subscription.currency,
  });
  const card = subscription.paymentMethodLast4
    ? `**** ${subscription.paymentMethodLast4}`
    : '—';

  async function openPortal(returnUrl?: string) {
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnUrl ? { returnUrl } : {}),
      });
      const json = await res.json();
      if (res.ok && json?.url) {
        window.open(json.url, '_blank');
      } else {
        throw new Error(json?.error);
      }
    } catch {
      toast.error('Não foi possível abrir o portal. Tente novamente.');
    }
  }

  async function cancel() {
    try {
      setCanceling(true);
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Renovação cancelada.');
      await refresh();
      await updateSession?.();
    } catch {
      toast.error('Não foi possível concluir no momento. Tente novamente.');
    } finally {
      setCanceling(false);
    }
  }

  async function reactivate() {
    try {
      setReactivating(true);
      const res = await fetch('/api/billing/reactivate', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Assinatura reativada.');
      await refresh();
      await updateSession?.();
    } catch {
      toast.error('Não foi possível concluir no momento. Tente novamente.');
    } finally {
      setReactivating(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 bg-white">
      <h3 className="mb-2 text-lg font-semibold">Plano {subscription.planName}</h3>
      {subscription.cancelAtPeriodEnd && (
        <ReactivateBanner onClick={() => reactivate()} />
      )}
      <div className="mb-2 text-sm text-gray-700">Status: {subscription.status}</div>
      <div className="mb-2 text-sm text-gray-700">
        Próxima cobrança: {amount} em {nextDate}
      </div>
      <div className="mb-4 text-sm text-gray-700">
        Método de pagamento: {subscription.defaultPaymentMethodBrand ?? ''} {card}
      </div>
      <div className="flex flex-col gap-2">
        {!subscription.cancelAtPeriodEnd && (
          <button
            onClick={() => setShowModal(true)}
            className="rounded bg-red-600 px-4 py-2 text-white text-sm"
            disabled={canceling}
          >
            Cancelar renovação
          </button>
        )}
        {subscription.cancelAtPeriodEnd && (
          <button
            onClick={() => reactivate()}
            className="rounded bg-blue-600 px-4 py-2 text-white text-sm"
            disabled={reactivating}
          >
            Reativar assinatura
          </button>
        )}
        <button
          onClick={() => openPortal()}
          className="rounded border px-4 py-2 text-sm"
        >
          Atualizar pagamento
        </button>
        <button
          onClick={() => openPortal()}
          className="rounded border px-4 py-2 text-sm"
        >
          Ver faturas/recibos
        </button>
      </div>
      <CancelSubscriptionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={() => {
          cancel();
          setShowModal(false);
        }}
        currentPeriodEnd={subscription.currentPeriodEnd}
      />
    </div>
  );
}
