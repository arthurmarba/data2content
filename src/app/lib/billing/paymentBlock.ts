// Quando a janela de assinatura não deve vender, e o que ela diz no lugar.
//
// Quem está com pagamento atrasado (past_due, unpaid) ou com uma assinatura
// começada e não concluída (incomplete, pending) não pode assinar de novo: o
// botão fica travado. Antes, a janela mostrava os benefícios do Pro com esse
// botão apagado e mais nada — o caminho para acertar só aparecia depois de um
// clique que não acontecia. Agora ela abre dizendo o motivo e com a ação certa,
// que leva à página "Seu plano" (portal do Stripe ou retomada do checkout).
//
// Pagamento pendente vence o "você já tem o Pro": um pagamento atrasado ainda
// pode contar como acesso ativo, e dizer "já é Pro" a quem precisa pagar
// esconderia o problema.

export const BILLING_PAGE_ROUTE = "/dashboard/billing";

export interface PaymentBlock {
  message: string;
  actionLabel: string;
  href: string;
}

export function resolvePaymentBlock(status: {
  loading?: boolean;
  error?: unknown;
  needsPaymentUpdate?: boolean;
  needsCheckout?: boolean;
}): PaymentBlock | null {
  if (status.loading || status.error) return null;
  if (status.needsPaymentUpdate) {
    return {
      message: "Seu último pagamento não passou. Atualize a forma de pagamento e o Pro volta a funcionar.",
      actionLabel: "Atualizar pagamento",
      href: BILLING_PAGE_ROUTE,
    };
  }
  if (status.needsCheckout) {
    return {
      message: "Você começou uma assinatura e ela não foi concluída. Retome ou cancele essa tentativa antes de começar outra.",
      actionLabel: "Resolver pendência",
      href: BILLING_PAGE_ROUTE,
    };
  }
  return null;
}
