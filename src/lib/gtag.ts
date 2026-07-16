export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';

type GoogleTagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

const getGoogleTag = () => {
  if (typeof window === 'undefined' || !GA_TRACKING_ID) return null;
  const gtag = (window as GoogleTagWindow).gtag;
  return typeof gtag === 'function' ? gtag : null;
};

export const pageview = (url: string) => {
  const gtag = getGoogleTag();
  if (!gtag) return false;

  gtag('event', 'page_view', {
    page_path: url,
    page_location: `${window.location.origin}${url}`,
    page_title: document.title,
  });
  return true;
};

export const event = (
  action: string,
  params: Record<string, unknown>,
) => {
  const gtag = getGoogleTag();
  if (!gtag) return false;
  gtag('event', action, params);
  return true;
};
