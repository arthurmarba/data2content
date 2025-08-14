import { useCallback } from 'react';
import toast from 'react-hot-toast';

export default function useBillingPortal() {
  return useCallback(async () => {
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao abrir portal');
      const url = json?.url;
      if (url) window.open(url, '_blank');
      toast.success('Portal de pagamento aberto');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao abrir portal');
    }
  }, []);
}
