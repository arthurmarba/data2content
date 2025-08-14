export const REDEEM_BLOCK_MESSAGES = {
  needsOnboarding: 'Conecte sua conta Stripe para sacar.',
  payouts_disabled: 'Sua conta Stripe precisa de verificação de documentos.',
  below_min: (min: string) => `Mínimo para saque: ${min}.`,
  has_debt: (amount: string) => `Você possui dívida de ${amount} por reembolsos.`,
  currency_mismatch: (dst: string, cur: string) => `Sua conta Stripe recebe em ${dst}; este saldo está em ${cur}.`,
} as const;

export const RULES_COPY = [
  'Pagamos 10% apenas no 1º pagamento real do indicado (trial/descontos 100% não contam).',
  'Mantemos por 7 dias para cobrir reembolsos.',
];
