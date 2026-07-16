'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { pageview } from '@/lib/gtag';

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = queryString ? `${pathname}?${queryString}` : pathname;

    const trackCurrentPage = () => {
      if (lastTrackedUrl.current === url) return;
      if (pageview(url)) lastTrackedUrl.current = url;
    };

    trackCurrentPage();
    window.addEventListener('d2c-google-analytics-ready', trackCurrentPage);

    return () => {
      window.removeEventListener('d2c-google-analytics-ready', trackCurrentPage);
    };
  }, [pathname, queryString]);

  return null;
}
