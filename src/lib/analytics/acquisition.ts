/** Vocabulário compartilhado; nunca guardar texto de formulário ou URL completa. */
export const ACQUISITION_COOKIE = 'd2c_acquisition';
export const ACQUISITION_CAMPAIGN = 'contexto_real_minimo_set2026';
export const ACQUISITION_CAMPAIGN_ID = 'cmpn_4164b938c3d48198ad1e70aacbc56725';
export const ACQUISITION_ADS = [
  { content: 'roteiros_1', group: 'Roteiros', id: 'ad_e55fb6ce6764819ca78acbaede8cb924', title: 'Esse roteiro ficou genérico?' },
  { content: 'roteiros_2', group: 'Roteiros', id: 'ad_080a4455ae3c81a0a016cbafbdeb5588', title: 'Esse roteiro não parece seu?' },
  { content: 'ideias_1', group: 'Ideias', id: 'ad_fc66d5fe94fc81a1a492d5c273f2f4be', title: 'Essa ideia serviria para qualquer pessoa?' },
  { content: 'ideias_2', group: 'Ideias', id: 'ad_4e7b8ba1d8dc81a19962054b2f4d21a6', title: 'Mais ideias. Nenhuma com a sua cara?' },
  { content: 'engajamento_1', group: 'Engajamento', id: 'ad_230f0fe7194881929ce7bf2b60c299fd', title: 'Mais uma dica de "poste com frequência"?' },
  { content: 'engajamento_2', group: 'Engajamento', id: 'ad_eb6913149680819f942ea8deb85319a4', title: 'O alcance caiu. Mas por quê?' },
] as const;
export const ACQUISITION_STEPS = {
  arrival: 'Chegou ao site', pricing_viewed: 'Viu o preço', signup_clicked: 'Clicou para entrar',
  account_created: 'Criou a conta', login: 'Entrou em conta existente',
  onboarding_completed: 'Concluiu o cadastro', instagram_connected: 'Instagram conectado (observado)',
  checkout_started: 'Iniciou o checkout', subscription_started: 'Assinatura iniciada (inclui grátis)',
  first_payment: 'Primeiro pagamento positivo', payment_received: 'Pagamento recebido',
} as const;
export type AcquisitionStep = keyof typeof ACQUISITION_STEPS;
export type AcquisitionTouch = { source: string; medium: string; campaign: string; content: string; at: Date };

export function parseAcquisitionTouch(params: URLSearchParams, at = new Date()): AcquisitionTouch | null {
  const content = params.get('utm_content');
  if (params.get('utm_source') !== 'chatgpt' || params.get('utm_medium') !== 'paid'
    || params.get('utm_campaign') !== ACQUISITION_CAMPAIGN
    || !ACQUISITION_ADS.some(ad => ad.content === content)) return null;
  return { source: 'chatgpt', medium: 'paid', campaign: ACQUISITION_CAMPAIGN, content: content!, at };
}

export function acquisitionStepFromAnalytics(name: string, props?: Record<string, unknown>): AcquisitionStep | null {
  if (name === 'landing_section_view' && props?.section === 'pricing') return 'pricing_viewed';
  if (name === 'landing_creator_cta_click') return 'signup_clicked';
  return null; // Assinatura, cadastro e dinheiro só são confirmados pelo servidor.
}

export function isTouchEligible(touch: AcquisitionTouch, at: Date): boolean {
  const age = at.getTime() - new Date(touch.at).getTime();
  return age >= 0 && age <= 30 * 86_400_000;
}

export function consentGranted(): boolean {
  return typeof document !== 'undefined' && document.cookie.split(';').some(c => c.trim() === 'cookie_consent=granted');
}
