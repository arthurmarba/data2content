export const MONTHLY_PRICE = parseFloat(process.env.MONTHLY_PLAN_PRICE || '97');
// Anual exibido como equivalente mensal: R$ 890/ano ÷ 12 = R$ 74,17/mês
export const ANNUAL_MONTHLY_PRICE = parseFloat(process.env.ANNUAL_PLAN_MONTHLY_PRICE || '74.1667');
export const AGENCY_GUEST_MONTHLY_PRICE = parseFloat(process.env.AGENCY_GUEST_MONTHLY_PRICE || '39.9');
export const AGENCY_GUEST_ANNUAL_MONTHLY_PRICE = parseFloat(process.env.AGENCY_GUEST_ANNUAL_MONTHLY_PRICE || '19.9');
export const AGENCY_MONTHLY_PRICE = parseFloat(process.env.AGENCY_MONTHLY_PRICE || '99');
export const AGENCY_ANNUAL_MONTHLY_PRICE = parseFloat(process.env.AGENCY_ANNUAL_MONTHLY_PRICE || '90');
