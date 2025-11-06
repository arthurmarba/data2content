export type AnalyticsUserProperties = {
  plan?: string | null;
  country?: string | null;
  niche?: string | null;
  followers_band?: string | null;
  has_media_kit?: boolean;
  instagram_connected?: boolean;
  is_internal?: boolean;
};

let pendingUserProperties: AnalyticsUserProperties | null = null;
let flushTimer: number | null = null;

const mergeProperties = (next: AnalyticsUserProperties) => {
  pendingUserProperties = {
    ...(pendingUserProperties ?? {}),
    ...Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    ),
  };
};

const flushUserProperties = () => {
  if (typeof window === "undefined" || !pendingUserProperties) return false;
  const gtag = (window as any).gtag;
  if (typeof gtag !== "function") return false;
  gtag("set", "user_properties", pendingUserProperties);
  return true;
};

const ensureFlushLoop = () => {
  if (typeof window === "undefined") return;
  if (flushTimer) return;
  flushTimer = window.setInterval(() => {
    if (flushUserProperties() && flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }, 500);
};

export const setAnalyticsUserProperties = (properties: AnalyticsUserProperties) => {
  mergeProperties(properties);
  if (!flushUserProperties()) {
    ensureFlushLoop();
  }
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[analytics][user_properties]", pendingUserProperties);
  }
};
