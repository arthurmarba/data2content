export const SERVICE_TERMS_VERSION = "2026-06-03";
export const PRIVACY_POLICY_VERSION = "2026-06-03";
export const COMMUNITY_INSPIRATION_VERSION = "2026-06-03";

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
