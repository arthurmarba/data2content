export const LEGAL_CONSENT_COOKIE_NAME = "d2c-legal-consent";
export const LEGAL_CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60;

export const SERVICE_TERMS_VERSION = "2026-04-03";
export const PRIVACY_POLICY_VERSION = "2026-04-03";
export const COMMUNITY_INSPIRATION_TERMS_VERSION = "1.0_community_included";

export type LegalAcceptanceSnapshot = {
  serviceTermsAcceptedAt?: Date | string | null;
  serviceTermsVersion?: string | null;
  privacyPolicyAcceptedAt?: Date | string | null;
  privacyPolicyVersion?: string | null;
};

export function hasRecordedLegalAcceptance(
  user: LegalAcceptanceSnapshot | null | undefined,
) {
  return Boolean(
    user?.serviceTermsAcceptedAt &&
      user?.serviceTermsVersion &&
      user?.privacyPolicyAcceptedAt &&
      user?.privacyPolicyVersion,
  );
}

export function hasCurrentLegalAcceptance(
  user: LegalAcceptanceSnapshot | null | undefined,
) {
  return Boolean(
    user?.serviceTermsAcceptedAt &&
      user?.privacyPolicyAcceptedAt &&
      user?.serviceTermsVersion === SERVICE_TERMS_VERSION &&
      user?.privacyPolicyVersion === PRIVACY_POLICY_VERSION,
  );
}
