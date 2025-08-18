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
  const [isPortalLoading, setIsPortalLoading] = useState(false);

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
    setIsPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnUrl ? { returnUrl } : {}),
      });
      const json = await res.json();
      if (res.ok && json?.url) {
        window.location.href = json.url;
      } else {
        throw new Error(json?.error || 'Não foi possível obter a URL do portal.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível abrir o portal. Tente novamente.');
      setIsPortalLoading(false);
    }
  }

  // <<< INÍCIO DA CORREÇÃO >>>
  async function cancel() {
    try {
      setCanceling(true);
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Renovação cancelada. Atualizando...');
      // Força a recarga da página para buscar os dados mais recentes do servidor.
      window.location.reload();
    } catch {
      toast.error('Não foi possível concluir no momento. Tente novamente.');
      setCanceling(false); // Só desativa o loading em caso de erro.
    }
  }

  async function reactivate() {
    try {
      setReactivating(true);
      const res = await fetch('/api/billing/reactivate', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Assinatura reativada. Atualizando...');
      // Força a recarga da página para buscar os dados mais recentes.
      window.location.reload();
    } catch {
      toast.error('Não foi possível concluir no momento. Tente novamente.');
      setReactivating(false); // Só desativa o loading em caso de erro.
    }
  }
  // <<< FIM DA CORREÇÃO >>>

  return (
    <div className="rounded-xl border p-4 bg-white">
      <h3 className="mb-2 text-lg font-semibold">Plano {subscription.planName}</h3>
      {subscription.cancelAtPeriodEnd && (
        <ReactivateBanner onClick={reactivate} disabled={reactivating}/>
      )}
      <div className="mb-2 text-sm text-gray-700">Status: {subscription.status}</div>
      {!subscription.cancelAtPeriodEnd && (
        <div className="mb-2 text-sm text-gray-700">
          Próxima cobrança: {amount} em {nextDate}
        </div>
      )}
      <div className="mb-4 text-sm text-gray-700">
        Método de pagamento: {subscription.defaultPaymentMethodBrand ?? ''} {card}
      </div>
      <div className="flex flex-col gap-2">
        {!subscription.cancelAtPeriodEnd && (
          <button
            onClick={() => setShowModal(true)}
            className="rounded bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
            disabled={canceling}
          >
            {canceling ? 'Cancelando...' : 'Cancelar renovação'}
          </button>
        )}
        {subscription.cancelAtPeriodEnd && (
          <button
            onClick={reactivate}
            className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            disabled={reactivating}
          >
            {reactivating ? 'Reativando...' : 'Reativar assinatura'}
          </button>
        )}
        
        {/* Botões do portal comentados temporariamente */}
        {/*
        <button
          onClick={() => openPortal()}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          disabled={isPortalLoading}
        >
          {isPortalLoading ? 'Abrindo...' : 'Atualizar pagamento'}
        </button>
        <button
          onClick={() => openPortal()}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          disabled={isPortalLoading}
        >
          {isPortalLoading ? 'Abrindo...' : 'Ver faturas/recibos'}
        </button>
        */}
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