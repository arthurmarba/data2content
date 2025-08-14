import { useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import toast from 'react-hot-toast';

export default function useCancelSubscription() {
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);

  const cancel = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao cancelar');
      toast.success('Renovação cancelada.');
      await mutate('/api/billing/subscription');
      return json;
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cancelar');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutate]);

  return { cancel, loading };
}
