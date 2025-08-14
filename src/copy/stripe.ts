export const STRIPE_STATUS = {
  verified: 'Verificado',
  action_needed: 'Ação necessária',
  under_review: 'Em revisão',
} as const;

export const STRIPE_DISABLED_REASON: Record<string, {title: string, body: string, cta?: 'onboarding'|'contact'|'wait'}> = {
  'requirements.past_due': {
    title: 'Informações pendentes',
    body: 'Faltam documentos obrigatórios no Stripe. Envie-os para liberar seus saques.',
    cta: 'onboarding',
  },
  'requirements.pending_verification': {
    title: 'Verificação em andamento',
    body: 'O Stripe está verificando seus documentos. Isso pode levar algum tempo.',
    cta: 'wait',
  },
  'rejected.fraud': {
    title: 'Conta rejeitada',
    body: 'Sua conta foi rejeitada por suspeita de fraude. Entre em contato com o suporte do Stripe.',
    cta: 'contact',
  },
  'rejected.terms_of_service': {
    title: 'Conta rejeitada',
    body: 'Houve um problema com os Termos do Stripe. Fale com o suporte do Stripe para detalhes.',
    cta: 'contact',
  },
  'under_review': {
    title: 'Conta em revisão',
    body: 'Sua conta está passando por uma revisão interna do Stripe.',
    cta: 'wait',
  },
  // fallback genérico
  default: {
    title: 'Ação necessária no Stripe',
    body: 'Há uma pendência na sua conta Stripe. Revise seu cadastro para liberar os saques.',
    cta: 'onboarding',
  },
};

export const CURRENCY_HELP = {
  mismatch_banner: (balCur: string, dstCur: string) =>
    `Você tem saldo em ${balCur}. Sua conta Stripe recebe em ${dstCur}.`,
  mismatch_reason: (balCur: string, dstCur: string) =>
    `Sua conta Stripe recebe em ${dstCur}; este saldo está em ${balCur}.`,
  options_title: (balCur: string) => `Como sacar ${balCur}?`,
  options: [
    'Usar outra conta Stripe que receba na mesma moeda.',
    'Ajustar sua conta junto ao Stripe para aceitar a moeda (quando o país permitir).',
    'Solicitar ajuda ao suporte para alternativas.',
  ],
} as const;

