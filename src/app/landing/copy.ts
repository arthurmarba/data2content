export const LANDING_JOIN_CTA_LABEL = "Entrar na D2C";
export const LANDING_AUTHENTICATED_CTA_LABEL = "Acessar a D2C";
export const LANDING_PLAN_PRICE_AMOUNT = "97.00";
export const LANDING_PLAN_PRICE_DISPLAY = "R$ 97,00";
export const LANDING_PRICE_SUPPORT =
  `Reunião semanal e plataforma por ${LANDING_PLAN_PRICE_DISPLAY}/mês`;

export function getLandingPrimaryCtaLabel(isAuthenticated: boolean) {
  return isAuthenticated ? LANDING_AUTHENTICATED_CTA_LABEL : LANDING_JOIN_CTA_LABEL;
}
