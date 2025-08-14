export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  available: 'Disponível',
  paid: 'Pago',
  canceled: 'Cancelado',
  reversed: 'Revertido',
};

export const REASON_LABEL: Record<string, string> = {
  refund_within_hold: 'Reembolso dentro do período de 7 dias.',
  refund_after_payout: 'Reembolso após liberação (ajuste aplicado).',
  chargeback: 'Estorno por contestação do pagamento.',
  adjustment_after_redeem: 'Ajuste pós-resgate.',
  self_referral_blocked: 'Autoindicação não é elegível a comissão.',
  coupon_100: 'Pagamento com 100% de desconto não gera comissão.',
  trial_no_commission: 'Período de teste gratuito não gera comissão.',
  currency_mismatch: 'Moeda incompatível para saque.',
  duplicate_prevented: 'Entrada duplicada ignorada.',
  admin_manual_correction: 'Correção manual pela equipe.',
};

export function humanizeReason(code?: string | null): string {
  if (!code) return 'Ajuste no registro.';
  return REASON_LABEL[code] ?? 'Ajuste no registro.';
}
