export const PERSONAL_PRICING_REFERENCE_SCOPE = 'reel_organico_padrao' as const;
export const PERSONAL_PRICING_REFERENCE_MAX_BRL = 100_000;
export const PERSONAL_PRICING_REFERENCE_REVIEW_DAYS = 90;

export type PersonalPricingReference = {
  valueBRL: number;
  scope: typeof PERSONAL_PRICING_REFERENCE_SCOPE;
  confirmedAt: Date;
  updatedAt: Date;
};

export function sanitizePersonalPricingReference(
  raw: unknown,
  now = new Date()
): PersonalPricingReference | null {
  if (!raw || typeof raw !== 'object') return null;

  const value = Number((raw as { valueBRL?: unknown }).valueBRL);
  if (!Number.isFinite(value) || value <= 0 || value > PERSONAL_PRICING_REFERENCE_MAX_BRL) return null;

  const scope = (raw as { scope?: unknown }).scope;
  if (scope !== PERSONAL_PRICING_REFERENCE_SCOPE) return null;

  const parseDate = (value: unknown): Date | null => {
    const parsed = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const confirmedAt = parseDate((raw as { confirmedAt?: unknown }).confirmedAt) ?? now;
  const updatedAt = parseDate((raw as { updatedAt?: unknown }).updatedAt) ?? now;

  return {
    valueBRL: Math.round(value * 100) / 100,
    scope: PERSONAL_PRICING_REFERENCE_SCOPE,
    confirmedAt,
    updatedAt,
  };
}

export function isPersonalPricingReferenceExpired(
  reference: Pick<PersonalPricingReference, 'confirmedAt'>,
  now = new Date()
): boolean {
  const ageMs = now.getTime() - new Date(reference.confirmedAt).getTime();
  return ageMs > PERSONAL_PRICING_REFERENCE_REVIEW_DAYS * 24 * 60 * 60 * 1000;
}

export function personalPricingReferenceAgeDays(
  reference: Pick<PersonalPricingReference, 'confirmedAt'>,
  now = new Date()
): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(reference.confirmedAt).getTime()) / 86_400_000));
}
