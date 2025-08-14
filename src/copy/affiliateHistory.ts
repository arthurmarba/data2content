export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  available: 'Disponível',
  paid: 'Pago',
  canceled: 'Cancelado',
  reversed: 'Revertido',
};

export const REASON_LABEL: Record<string, string> = {
  refund_within_hold: 'Reembolso dentro do período de retenção — comissão cancelada.',
  refund_after_release: 'Reembolso após liberação — ajuste aplicado.',
  self_referral_blocked: 'Autoindicação não gera comissão.',
  duplicates_blocked: 'Pagamento duplicado — comissão ignorada.',
  payout_rejected: 'Saque rejeitado — valor recreditado ao saldo.',
  transfer_reversed: 'Transferência revertida pelo Stripe — valor recreditado.',
  race_condition: 'Concorrência detectada — operação não concluída.',
};

export function humanizeReason(code?: string | null): string {
  if (!code) return 'Ajuste administrativo.';
  return REASON_LABEL[code] ?? 'Ajuste administrativo.';
}
