const AFFILIATE_LANDING_PATH = '/';

const resolveAppOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  const fallback = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return fallback ? fallback.replace(/\/$/, '') : '';
};

/** Link de cadastro com o código de afiliado de quem publicou o mídia kit. */
export const buildAffiliateSignupLink = ({
  affiliateCode,
  mediaKitSlug,
  affiliateHandle,
}: {
  affiliateCode: string;
  mediaKitSlug?: string | null;
  affiliateHandle?: string | null;
}) => {
  const origin = resolveAppOrigin();
  if (!origin) return null;
  try {
    const url = new URL(`${origin}${AFFILIATE_LANDING_PATH}`);
    url.searchParams.set('aff', affiliateCode);
    url.searchParams.set('utm_source', 'mediakit');
    url.searchParams.set('utm_medium', 'affiliate_cta');
    url.searchParams.set('utm_campaign', mediaKitSlug || 'public');
    url.searchParams.set('origin_affiliate', affiliateCode);
    if (mediaKitSlug) url.searchParams.set('origin_slug', mediaKitSlug);
    if (affiliateHandle) url.searchParams.set('origin_handle', affiliateHandle);
    return url.toString();
  } catch {
    return null;
  }
};
