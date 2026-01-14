// src/components/billing/SubscriptionCard.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/hooks/billing/useSubscription';
import toast from 'react-hot-toast';
import CancelSubscriptionModal from './CancelSubscriptionModal';
import ReactivateBanner from './ReactivateBanner';
import SkeletonRow from '@/components/ui/SkeletonRow';
import ErrorState from '@/components/ui/ErrorState';
import { buildCheckoutUrl } from '@/app/lib/checkoutRedirect';

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

type Props = {
  onChangePlan?: () => void;
};

export default function SubscriptionCard({ onChangePlan }: Props) {
  const router = useRouter();
  const { subscription, error, isLoading, refresh } = useSubscription();
  const [showModal, setShowModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [aborting, setAborting] = useState(false);

  if (isLoading) return <SkeletonRow />;
  if (error) return <ErrorState message="Erro ao carregar assinatura." />;

  if (!subscription) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#D8D8DE] bg-[#FCFCFD] p-4 sm:p-5 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#1E1E1E]">
            <span role="img" aria-label="cadeado">
              🔒
            </span>
            Status da assinatura
          </div>
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#F3F3F5] px-3 py-1 text-[12px] font-medium text-[#888]">
            Sem assinatura
          </span>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-[#555]">
          Você ainda não possui uma assinatura ativa. Escolha um plano para desbloquear todos os recursos da plataforma.
        </p>
        <a
          href="/dashboard/billing/checkout"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-[#D62E5E] to-[#9326A6] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D62E5E]"
        >
          Assinar agora
        </a>
      </div>
    );
  }

  const statusRaw = String(subscription.status || '').toLowerCase();
  const status = statusRaw || 'inactive';
  const isActive = status === 'active';
  const isTrialing = status === 'trialing';
  const isNonRenewing = status === 'non_renewing';
  const isPending = status === 'pending' || status === 'incomplete';
  const isIncompleteExpired = status === 'incomplete_expired';
  const isPastDue = status === 'past_due';
  const isUnpaid = status === 'unpaid';
  const isCanceled = status === 'canceled';
  const isInactive = status === 'inactive' || status === 'expired';

  const showReactivate = isNonRenewing && subscription.cancelAtPeriodEnd === true;
  const canCancel = (isActive || isTrialing) && !subscription.cancelAtPeriodEnd;
  const canResumeCheckout = isPending;
  const canAbortCheckout = isPending || isIncompleteExpired;
  const showSubscribeAgain = isCanceled || isInactive || isIncompleteExpired;
  const canChangePlan = isActive;
  const showChangePlanButton = canChangePlan;
  const showPortal =
    (isActive || isTrialing || isNonRenewing || isPastDue || isUnpaid) &&
    !isPending &&
    !isIncompleteExpired;
  const portalLabel = isPastDue || isUnpaid ? 'Atualizar pagamento' : 'Gerenciar pagamento';

  const handleChangePlan = () => {
    if (onChangePlan) {
      onChangePlan();
      return;
    }
    const target = document.getElementById('change-plan');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
      ? 'Cancelamento agendado'
      : isActive
        ? 'Ativo'
        : isPastDue
          ? 'Pagamento pendente'
          : isUnpaid
            ? 'Pagamento recusado'
            : isPending
              ? 'Pagamento pendente'
              : isIncompleteExpired
                ? 'Pagamento expirado'
                : isCanceled
                  ? 'Assinatura cancelada'
                  : isInactive
                    ? 'Sem assinatura'
                    : status
                      ? status.charAt(0).toUpperCase() + status.slice(1)
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
    ? `${subscription.defaultPaymentMethodBrand ?? ''} ${subscription.paymentMethodLast4 ? `**** ${subscription.paymentMethodLast4}` : ''
      }`.trim()
    : '—';

  const statusTheme = (() => {
    if (showReactivate || isNonRenewing) return { bg: 'bg-[#FFF2F4]', text: 'text-[#B3264E]' };
    if (isTrialing) return { bg: 'bg-[#F4F8FF]', text: 'text-[#2053B4]' };
    if (isActive) return { bg: 'bg-[#E8F8F1]', text: 'text-[#0E7B50]' };
    if (isPastDue || isPending || isUnpaid || isIncompleteExpired) {
      return { bg: 'bg-[#FFF2F0]', text: 'text-[#B4232D]' };
    }
    return { bg: 'bg-[#F3F3F5]', text: 'text-[#555]' };
  })();

  const statusHint: string = isPending
    ? 'Checkout pendente — conclua o pagamento para ativar o plano.'
    : isIncompleteExpired
      ? 'Tentativa expirada — voce pode iniciar um novo checkout.'
      : isPastDue || isUnpaid
        ? 'Pagamento pendente — atualize o método de pagamento para liberar o acesso.'
        : isNonRenewing
          ? 'Cancelamento agendado — reative se quiser continuar no próximo ciclo.'
          : isTrialing
            ? 'Teste ativo — troca de plano disponível após o fim do período.'
            : isCanceled
              ? 'Assinatura cancelada — você pode assinar novamente quando quiser.'
              : isInactive
                ? 'Nenhuma assinatura ativa no momento.'
                : isActive
                  ? 'Assinatura ativa — você pode gerenciar cobrança ou cancelar a renovação.'
                  : 'Acompanhe detalhes da sua assinatura e mantenha seus dados de cobrança atualizados.';

  // Cancelar (agendar no fim do ciclo; no trial vira "não renovar ao final do teste")
  async function cancel({
    reasons,
    comment,
  }: {
    reasons: string[];
    comment: string;
  }) {
    try {
      setCanceling(true);
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasons, comment }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || 'Não foi possível cancelar a renovação.');
        return;
      }
      toast.success(
        isTrialing
          ? 'Teste não será renovado. Atualizando...'
          : 'Renovação cancelada. Atualizando...'
      );
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('billing-status-refresh'));
      }
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
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.code;
        if (code === 'NOT_REACTIVATABLE_USE_SUBSCRIBE') {
          toast.error(data?.message || 'Assinatura cancelada definitivamente. Assine novamente.');
          await refresh();
          router.push('/dashboard/billing/checkout');
          return;
        }
        if (code === 'NOT_REACTIVATABLE_NOT_CANCELING') {
          toast.error(data?.message || 'Assinatura já está ativa e sem cancelamento agendado.');
          return;
        }
        if (code === 'NOT_REACTIVATABLE_STATUS') {
          toast.error(data?.message || 'Assinatura não está ativa para reativação.');
          return;
        }
        toast.error(data?.message || 'Não foi possível reativar no momento.');
        return;
      }
      toast.success('Assinatura reativada. Atualizando...');
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('billing-status-refresh'));
      }
    } catch {
      toast.error('Não foi possível concluir no momento. Tente novamente.');
    } finally {
      setReactivating(false);
    }
  }

  async function openPortal() {
    try {
      setOpeningPortal(true);
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || data?.error || 'Não foi possível abrir o portal de cobrança.');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Não foi possível abrir o portal de cobrança.');
    } finally {
      setOpeningPortal(false);
    }
  }

  async function resumeCheckout() {
    try {
      setResuming(true);
      const res = await fetch('/api/billing/resume', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.code;
        if (code === 'SUBSCRIPTION_INCOMPLETE_EXPIRED') {
          toast.error(data?.message || 'Tentativa expirada. Voce pode iniciar um novo checkout.');
          await refresh();
          return;
        }
        if (code === 'PAYMENT_ISSUE') {
          toast.error(data?.message || 'Pagamento pendente. Atualize o método de pagamento no portal.');
          await refresh();
          return;
        }
        if (code === 'SUBSCRIPTION_ACTIVE') {
          toast.success(data?.message || 'Assinatura já está ativa.');
          await refresh();
          return;
        }
        if (code === 'BILLING_RESUME_NOT_PENDING') {
          toast.error(data?.message || 'Não há checkout pendente para retomar.');
          await refresh();
          return;
        }
        toast.error(data?.message || 'Falha ao retomar o checkout.');
        return;
      }
      if (!data?.clientSecret) {
        toast.error('Não foi possível retomar o pagamento. Tente novamente.');
        return;
      }
      router.push(buildCheckoutUrl(data.clientSecret, data.subscriptionId));
    } catch {
      toast.error('Falha ao retomar o checkout.');
    } finally {
      setResuming(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('billing-status-refresh'));
      }
    }
  }

  async function abortPending() {
    const ok = confirm('Abortar tentativa pendente? Isso libera um novo checkout.');
    if (!ok) return;
    try {
      setAborting(true);
      const res = await fetch('/api/billing/abort', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || data?.error || 'Falha ao abortar tentativa.');
        return;
      }
      toast.success('Tentativa cancelada. Você pode assinar novamente.');
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('billing-status-refresh'));
      }
    } catch {
      toast.error('Falha ao abortar tentativa.');
    } finally {
      setAborting(false);
    }
  }

  return (
    <div className="rounded-[12px] border border-[#ECECF0] bg-[#FCFCFD] p-4 sm:p-5 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-[22px]" aria-hidden>
            🪙
          </span>
          <div>
            <p className="text-[15px] font-semibold text-[#1E1E1E]">Plano {subscription.planName}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#666]">
              {statusHint}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-[6px] px-3 py-1 text-[12px] font-semibold ${statusTheme.bg} ${statusTheme.text}`}
        >
          {statusLabel}
        </span>
      </div>

      {showReactivate && (
        <div className="mt-4">
          <ReactivateBanner onClick={reactivate} disabled={reactivating} />
        </div>
      )}

      <div className="mt-4 grid gap-3 text-[14px] leading-relaxed text-[#555]">
        {isTrialing ? (
          <p>
            Teste gratuito — cobrança em{' '}
            <span className="font-medium text-[#1E1E1E]">
              {nextInvoiceDateLabel || trialEndLabel || '—'}
            </span>{' '}
            <span className="text-[#888]">(nenhuma cobrança até lá)</span>
          </p>
        ) : (
          isActive &&
          !subscription.cancelAtPeriodEnd &&
          amount &&
          nextInvoiceDateLabel &&
          nextInvoiceDateLabel !== '—' && (
            <p>
              Próxima cobrança de{' '}
              <span className="font-semibold text-[#1E1E1E]">{amount}</span> em{' '}
              <span className="font-medium text-[#1E1E1E]">{nextInvoiceDateLabel}</span>.
            </p>
          )
        )}

        <p>
          Método de pagamento:{' '}
          <span className="font-medium text-[#1E1E1E]">{pmLabel}</span>
        </p>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          {canResumeCheckout && (
            <button
              type="button"
              onClick={resumeCheckout}
              className="w-full min-h-[44px] rounded-[8px] bg-gradient-to-r from-[#D62E5E] to-[#9326A6] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D62E5E] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resuming}
            >
              {resuming ? 'Continuando...' : 'Continuar checkout'}
            </button>
          )}

          {canAbortCheckout && (
            <button
              type="button"
              onClick={abortPending}
              className="w-full min-h-[44px] rounded-[8px] border border-[#E6E6EB] px-4 py-2.5 text-[14px] font-semibold text-[#B4232D] transition hover:border-[#B4232D] hover:bg-[#FFF2F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B4232D] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={aborting}
            >
              {aborting ? 'Abortando...' : 'Abortar tentativa'}
            </button>
          )}

          {showSubscribeAgain && (
            <a
              href="/dashboard/billing/checkout"
              className="w-full min-h-[44px] rounded-[8px] bg-gradient-to-r from-[#D62E5E] to-[#9326A6] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D62E5E]"
            >
              {isCanceled ? 'Assinar novamente' : 'Assinar agora'}
            </a>
          )}

          {showPortal && (
            <button
              type="button"
              onClick={openPortal}
              className="w-full min-h-[44px] rounded-[8px] border border-[#E6E6EB] px-4 py-2.5 text-[14px] font-semibold text-[#2053B4] transition hover:border-[#2053B4] hover:bg-[#F4F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2053B4] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={openingPortal}
            >
              {openingPortal ? 'Abrindo...' : portalLabel}
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="w-full min-h-[44px] rounded-[8px] border border-[#E6E6EB] px-4 py-2.5 text-[14px] font-semibold text-[#D62E5E] transition hover:border-[#D62E5E] hover:bg-[#FFF1F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D62E5E] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={canceling}
            >
              {canceling ? 'Cancelando...' : isTrialing ? 'Não renovar após o teste' : 'Cancelar renovação'}
            </button>
          )}

          {showReactivate && (
            <button
              type="button"
              onClick={reactivate}
              className="w-full min-h-[44px] rounded-[8px] bg-gradient-to-r from-[#D62E5E] to-[#9326A6] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D62E5E] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={reactivating}
            >
              {reactivating ? 'Reativando...' : 'Reativar assinatura'}
            </button>
          )}
        </div>

        {showChangePlanButton && (
          <button
            type="button"
            onClick={handleChangePlan}
            className="w-full min-h-[44px] rounded-[8px] bg-gradient-to-r from-[#D62E5E] to-[#9326A6] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D62E5E] sm:w-auto"
          >
            Mudar de plano
          </button>
        )}
      </div>

      <CancelSubscriptionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={(data) => {
          cancel(data);
          setShowModal(false);
        }}
        currentPeriodEnd={subscription.currentPeriodEnd}
      />
    </div>
  );
}
