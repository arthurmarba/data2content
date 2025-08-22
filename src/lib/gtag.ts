export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';

export const pageview = (url: string) => {
  (window as any).gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
};

export const event = (
  action: string,
  params: Record<string, any>
) => {
  (window as any).gtag('event', action, params);
};
