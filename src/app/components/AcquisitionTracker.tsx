'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { acquisitionStepFromAnalytics, consentGranted, parseAcquisitionTouch } from '@/lib/analytics/acquisition';

// Serializar evita duas requisições iniciais criarem cookies diferentes.
let queue: Promise<unknown> = Promise.resolve();
export async function flushAcquisitionTracking() {
  if (!consentGranted()) return;
  await Promise.race([queue, new Promise(resolve => setTimeout(resolve, 2000))]);
}
export default function AcquisitionTracker() {
  const pathname = usePathname(), params = useSearchParams();
  const { data: session, status } = useSession();
  useEffect(() => {
    const send = (step: string) => {
      if (!consentGranted()) return;
      const touch = parseAcquisitionTouch(new URLSearchParams(window.location.search));
      queue = queue.catch(() => {}).then(async () => {
        if (!consentGranted()) return;
        await fetch('/api/analytics/acquisition', { method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step, ...(touch ? { utm: { source: touch.source, medium: touch.medium, campaign: touch.campaign, content: touch.content } } : {}) }),
        });
      }).catch(() => {});
    };
    const sync = () => send(pathname === '/' ? 'arrival' : 'sync');
    const consent = () => {
      if (consentGranted()) {
        sync();
        const rect = document.querySelector('[data-landing-section="pricing"]')?.getBoundingClientRect();
        if (rect && rect.top < window.innerHeight && rect.bottom > 0) send('pricing_viewed');
      }
      else queue = queue.catch(() => {}).then(() => fetch('/api/analytics/acquisition', { method: 'DELETE', keepalive: true })).catch(() => {});
    };
    const analytics = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const step = acquisitionStepFromAnalytics(detail?.name, detail?.props);
      if (step) send(step);
    };
    if (document.cookie.split(';').some(c => c.trim() === 'cookie_consent=denied')) consent();
    else sync();
    const pricing = document.querySelector('[data-landing-section="pricing"]');
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) send('pricing_viewed');
    }, { threshold: 0.1 }) : null;
    if (pricing) observer?.observe(pricing);
    // Reconciliar marcos salvos no servidor mesmo sem trocar de página.
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible' && status === 'authenticated') send('sync'); }, 60_000);
    window.addEventListener('d2c-cookie-consent-change', consent);
    window.addEventListener('d2c-acquisition-analytics', analytics);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(interval);
      observer?.disconnect();
      window.removeEventListener('d2c-cookie-consent-change', consent);
      window.removeEventListener('d2c-acquisition-analytics', analytics);
      window.removeEventListener('focus', sync);
    };
  }, [pathname, params, status, session?.user?.id]);
  return null;
}
