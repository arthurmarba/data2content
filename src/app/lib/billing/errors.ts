export type BillingErrorAction = {
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

type ErrorConfig = Omit<BillingErrorAction, "message"> & {
  message: string;
};

const BILLING_ERROR_MAP: Record<string, ErrorConfig> = {
  PAYMENT_ISSUE: {
    message: "Pagamento pendente. Atualize a cobranca em Billing.",
    actionLabel: "Atualizar pagamento",
    actionHref: "/dashboard/billing",
  },
  SUBSCRIPTION_PAST_DUE: {
    message: "Pagamento pendente. Atualize a cobranca em Billing.",
    actionLabel: "Atualizar pagamento",
    actionHref: "/dashboard/billing",
  },
  BILLING_BLOCKED_PENDING_OR_INCOMPLETE: {
    message: "Ha um checkout pendente. Continue ou aborte em Billing.",
    actionLabel: "Resolver pendencia",
    actionHref: "/dashboard/billing",
  },
  SUBSCRIPTION_INCOMPLETE: {
    message: "Ha um checkout pendente. Continue ou aborte em Billing.",
    actionLabel: "Resolver pendencia",
    actionHref: "/dashboard/billing",
  },
  SUBSCRIPTION_ACTIVE: {
    message: "Voce ja possui uma assinatura ativa.",
    actionLabel: "Trocar plano",
    actionHref: "/dashboard/billing",
  },
  SUBSCRIPTION_ACTIVE_DB: {
    message: "Voce ja possui uma assinatura ativa.",
    actionLabel: "Trocar plano",
    actionHref: "/dashboard/billing",
  },
  SUBSCRIPTION_ACTIVE_USE_CHANGE_PLAN: {
    message: "Voce ja possui uma assinatura ativa.",
    actionLabel: "Trocar plano",
    actionHref: "/dashboard/billing",
  },
  SUBSCRIPTION_NON_RENEWING: {
    message: "Assinatura com cancelamento agendado. Reative em Billing.",
    actionLabel: "Reativar assinatura",
    actionHref: "/dashboard/billing",
  },
  SUBSCRIPTION_NON_RENEWING_DB: {
    message: "Assinatura com cancelamento agendado. Reative em Billing.",
    actionLabel: "Reativar assinatura",
    actionHref: "/dashboard/billing",
  },
  BILLING_IN_PROGRESS: {
    message: "Ja existe uma tentativa em andamento. Aguarde alguns segundos.",
  },
};

export function mapSubscribeError(
  code?: string | null,
  fallbackMessage?: string | null
): BillingErrorAction | null {
  if (!code) return null;
  const cfg = BILLING_ERROR_MAP[String(code)] ?? null;
  if (!cfg) return null;
  const message =
    typeof fallbackMessage === "string" && fallbackMessage.trim()
      ? fallbackMessage
      : cfg.message;
  return {
    message,
    actionLabel: cfg.actionLabel,
    actionHref: cfg.actionHref,
  };
}
