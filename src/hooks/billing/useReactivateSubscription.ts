import { useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import toast from 'react-hot-toast';

export default function useReactivateSubscription() {
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);

  const reactivate = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/reactivate', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao reativar');
      toast.success('Assinatura reativada.');
      await mutate('/api/billing/subscription');
      return json;
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao reativar');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutate]);

  return { reactivate, loading };
}
