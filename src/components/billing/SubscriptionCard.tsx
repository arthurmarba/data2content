// src/components/billing/SubscriptionCard.tsx
import { useState } from 'react';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import ReactivateBanner from './ReactivateBanner';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonRow from '@/components/ui/SkeletonRow';
import ErrorState from '@/components/ui/ErrorState';

/** ---------- Helpers robustos de data ---------- */
function toDate(value?: unknown): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    // aceita segundos (10 dígitos) ou milissegundos
    const ms = value < 2_000_000_000 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) {
      const ms = value.length <= 10 ? asNum * 1000 : asNum;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function formatDatePTBR(d: Date | null): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(d);
  } catch {
    try {
      return d.toLocaleDateString('pt-BR');
    } catch {
      return '—';
    }
  }
}

export default function SubscriptionCard() {
  const { subscription, error, isLoading } = useSubscription();
  const { update: updateSession } = useSession();
  const [showModal, setShowModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  if (isLoading) return <SkeletonRow />;
  if (error) return <ErrorState message="Erro ao carregar assinatura." />;
  if (!subscription) return <EmptyState text="Você ainda não tem assinatura" />;

  const statusRaw = String(subscription.status || '').toLowerCase();
  const isTrialing = statusRaw === 'trialing';
  const isNonRenewing = statusRaw === 'non_renewing';
  const showReactivate = subscription.cancelAtPeriodEnd === true;

  // Converte valores vindos da API (podem ser string/number/Date/null)
  const trialEndDate = toDate(subscription.trialEnd);
  const currentPeriodEndDate = toDate(subscription.currentPeriodEnd);
  const nextInvoiceDateDate = toDate(subscription.nextInvoiceDate);

  // Labels como string (sem useMemo para evitar unions chatos)
  const currentPeriodEndLabel: string = formatDatePTBR(currentPeriodEndDate);
  const nextInvoiceDateLabel: string = formatDatePTBR(nextInvoiceDateDate);
  const trialEndPrimary: string = formatDatePTBR(trialEndDate);
  const trialEndLabel: string = trialEndPrimary !== '—' ? trialEndPrimary : currentPeriodEndLabel;

  // Rótulo amigável do status
  const statusLabel: string = isTrialing
    ? 'Período de teste'
    : isNonRenewing
    ? 'Não renovará (ao fim do ciclo)'
    : statusRaw
    ? statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1)
    : '—';

  // Valores de “próxima cobrança”
  const amount =
    typeof subscription.nextInvoiceAmountCents === 'number'
      ? (subscription.nextInvoiceAmountCents / 100).toLocaleString(undefined, {
          style: 'currency',
          currency: (subscription.currency || 'BRL').toUpperCase(),
        })
      : null;

  const hasPM =
    !!subscription.paymentMethodLast4 || !!subscription.defaultPaymentMethodBrand;
  const pmLabel = hasPM
    ? `${subscription.defaultPaymentMethodBrand ?? ''} ${
        subscription.paymentMethodLast4 ? `**** ${subscription.paymentMethodLast4}` : ''
      }`.trim()
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

  // Cancelar (agendar no fim do ciclo; no trial vira "não renovar ao final do teste")
  async function cancel() {
    try {
      setCanceling(true);
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success(
        isTrialing ? 'Teste não será renovado. Atualizando...' : 'Renovação cancelada. Atualizando...'
      );
      window.location.reload();
    } catch {
      toast.error('Não foi possível concluir no momento. Tente novamente.');
      setCanceling(false);
    }
  }

  async function reactivate() {
    try {
      setReactivating(true);
      const res = await fetch('/api/billing/reactivate', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Assinatura reativada. Atualizando...');
      window.location.reload();
    } catch {
      toast.error('Não foi possível concluir no momento. Tente novamente.');
      setReactivating(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 bg-white">
      <h3 className="mb-2 text-lg font-semibold">Plano {subscription.planName}</h3>

      {showReactivate && (
        <ReactivateBanner onClick={reactivate} disabled={reactivating} />
      )}

      <div className="mb-2 text-sm text-gray-700">
        Status: <span className="font-medium">{statusLabel}</span>
      </div>

      {/* Informações de ciclo */}
      {isTrialing ? (
        <div className="mb-2 text-sm text-gray-700">
          {/* Preferimos mostrar “cobrança em …”. Usa nextInvoiceDate; se não vier, cai para trialEnd. */}
          Teste gratuito — cobrança em {nextInvoiceDateLabel || trialEndLabel || '—'}{' '}
          <span className="text-gray-500">(nenhuma cobrança até lá)</span>
        </div>
      ) : (
        !subscription.cancelAtPeriodEnd &&
        amount &&
        nextInvoiceDateLabel &&
        nextInvoiceDateLabel !== '—' && (
          <div className="mb-2 text-sm text-gray-700">
            Próxima cobrança: {amount} em {nextInvoiceDateLabel}
          </div>
        )
      )}

      <div className="mb-4 text-sm text-gray-700">
        Método de pagamento: {pmLabel}
      </div>

      <div className="flex flex-col gap-2">
        {!showReactivate && (
          <button
            onClick={() => setShowModal(true)}
            className="rounded bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
            disabled={canceling}
          >
            {canceling ? 'Cancelando...' : isTrialing ? 'Não renovar após o teste' : 'Cancelar renovação'}
          </button>
        )}

        {showReactivate && (
          <button
            onClick={reactivate}
            className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            disabled={reactivating}
          >
            {reactivating ? 'Reativando...' : 'Reativar assinatura'}
          </button>
        )}

        {/* Portal (se quiser reativar, remova os comentários) */}
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
