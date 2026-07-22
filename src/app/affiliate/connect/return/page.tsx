'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { normalizeAffiliateConnectReturn } from '@/lib/affiliateConnectReturn';

export default function ConnectReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    mutate('/api/affiliate/connect/status');
    const t = setTimeout(() => {
      router.replace(normalizeAffiliateConnectReturn(searchParams?.get('returnTo')));
    }, 100);
    return () => clearTimeout(t);
  }, [mutate, router, searchParams]);

  return (
    <div className="p-4 text-center text-sm text-gray-600">Redirecionando...</div>
  );
}
