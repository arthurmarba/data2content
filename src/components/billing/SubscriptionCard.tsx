import { useState } from 'react';
import useSubscription from '@/hooks/billing/useSubscription';
import useBillingPortal from '@/hooks/billing/useBillingPortal';
import useCancelSubscription from '@/hooks/billing/useCancelSubscription';
import useReactivateSubscription from '@/hooks/billing/useReactivateSubscription';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import ReactivateBanner from './ReactivateBanner';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonRow from '@/components/ui/SkeletonRow';
import ErrorState from '@/components/ui/ErrorState';

export default function SubscriptionCard() {
  const { subscription, loading, error } = useSubscription();
  const openPortal = useBillingPortal();
  const { cancel, loading: canceling } = useCancelSubscription();
  const { reactivate, loading: reactivating } = useReactivateSubscription();
  const [showModal, setShowModal] = useState(false);

  if (loading) return <SkeletonRow />;
  if (error) return <ErrorState message="Erro ao carregar assinatura." />;
  if (!subscription) return <EmptyState text="Você ainda não tem assinatura" />;

  const nextDate = subscription.nextInvoiceDate
    ? new Date(subscription.nextInvoiceDate).toLocaleDateString()
    : null;
  const amount = subscription.nextInvoiceAmountCents
    ? (subscription.nextInvoiceAmountCents / 100).toLocaleString(undefined, {
        style: 'currency',
        currency: subscription.currency,
      })
    : null;
  const card = subscription.paymentMethodLast4
    ? `**** ${subscription.paymentMethodLast4}`
    : '—';

  return (
    <div className="rounded-xl border p-4 bg-white">
      <h3 className="mb-2 text-lg font-semibold">Plano {subscription.planName}</h3>
      {subscription.cancelAtPeriodEnd && (
        <ReactivateBanner onClick={() => reactivate()} />
      )}
      <div className="mb-2 text-sm text-gray-700">Status: {subscription.status}</div>
      {amount && nextDate && (
        <div className="mb-2 text-sm text-gray-700">
          Próxima cobrança: {amount} em {nextDate}
        </div>
      )}
      <div className="mb-4 text-sm text-gray-700">
        Forma de pagamento: Cartão {card}
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
          onClick={openPortal}
          className="rounded border px-4 py-2 text-sm"
        >
          Atualizar pagamento
        </button>
        <button
          onClick={openPortal}
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
