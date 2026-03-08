export const LANDING_JOIN_CTA_LABEL = "Quero entrar na D2C";
export const LANDING_AUTHENTICATED_CTA_LABEL = "Acessar consultoria";
export const LANDING_PRICE_SUPPORT =
  "Plano consultivo por R$ 49,90/mês";

export function getLandingPrimaryCtaLabel(isAuthenticated: boolean) {
  return isAuthenticated ? LANDING_AUTHENTICATED_CTA_LABEL : LANDING_JOIN_CTA_LABEL;
}
