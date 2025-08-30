'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';

export default function ConnectRefreshPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    mutate('/api/affiliate/connect/status');
    const t = setTimeout(() => {
      router.replace('/dashboard/chat');
    }, 100);
    return () => clearTimeout(t);
  }, [mutate, router]);

  return (
    <div className="p-4 text-center text-sm text-gray-600">Redirecionando...</div>
  );
}
