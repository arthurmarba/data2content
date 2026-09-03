import type { AnalyticsEventName, AnalyticsEventPayload } from './analytics/events';

type PendingEvent<Name extends AnalyticsEventName = AnalyticsEventName> = {
  name: Name;
  payload?: AnalyticsEventPayload<Name>;
};

const pendingEvents: PendingEvent[] = [];

const resolveEnvironment = () => {
  if (typeof process !== 'undefined') {
    return (
      process.env.NEXT_PUBLIC_ANALYTICS_ENV ||
      process.env.NODE_ENV ||
      'development'
    );
  }
  return 'development';
};

const withCommonPayload = <Name extends AnalyticsEventName>(
  name: Name,
  payload?: AnalyticsEventPayload<Name>,
) => {
  const environment = resolveEnvironment();
  const eventTimestamp =
    (payload as Record<string, any> | undefined)?.event_timestamp ||
    new Date().toISOString();

  return {
    ...payload,
    environment,
    event_timestamp: eventTimestamp,
    event_name: name,
  };
};

let flushTimer: number | null = null;

const tryFlushQueue = () => {
  if (typeof window === 'undefined') return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') {
    return;
  }
  while (pendingEvents.length) {
    const event = pendingEvents.shift();
    if (!event) continue;
    gtag('event', event.name, withCommonPayload(event.name, event.payload));
  }
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
};

const ensureFlushLoop = () => {
  if (typeof window === 'undefined') return;
  if (flushTimer) return;
  flushTimer = window.setInterval(() => {
    tryFlushQueue();
  }, 400);
};

function measureOpenAiAdsEvent(
  name: AnalyticsEventName,
  props?: Record<string, any>,
) {
  if (typeof window === 'undefined' || name !== 'chatgpt_funnel_event') return;
  const oaiq = (window as any).oaiq;
  if (typeof oaiq !== 'function') return;

  switch (props?.step) {
    case 'resources_viewed':
      oaiq('measure', 'page_viewed', {
        type: 'contents',
        contents: [{
          id: 'data2content_chatgpt_resources',
          name: 'Data2Content no ChatGPT',
          content_type: 'page',
        }],
      });
      break;
    case 'checkout_started':
      oaiq('measure', 'checkout_started', {
        type: 'contents',
        contents: [{
          id: 'data2content_pro',
          name: 'Data2Content Pro',
          content_type: 'subscription',
          quantity: 1,
        }],
      });
      break;
    case 'subscription_activated':
      oaiq(
        'measure',
        'subscription_created',
        {
          type: 'plan_enrollment',
          plan_id: props?.status === 'anual' ? 'd2c_pro_annual' : 'd2c_pro_monthly',
        },
        ...(props?.event_id ? [{ event_id: props.event_id }] : []),
      );
      break;
    default:
      break;
  }
}

export function track<Name extends AnalyticsEventName>(
  name: Name,
  props?: AnalyticsEventPayload<Name>,
) {
  try {
    measureOpenAiAdsEvent(name, props as Record<string, any> | undefined);
    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', name, withCommonPayload(name, props));
      return;
    }
    if (typeof window !== 'undefined') {
      pendingEvents.push({ name, payload: props });
      ensureFlushLoop();
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[track]', name, withCommonPayload(name, props));
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[track] failed to enqueue event', { name, error });
    }
  }
}
