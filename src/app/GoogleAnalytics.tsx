'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { pageview } from '@/lib/gtag';

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    pageview(pathname);
  }, [pathname]);

  return null;
}
