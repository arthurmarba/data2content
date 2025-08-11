'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const planStatus = session?.user?.planStatus ?? 'inactive';
  const canDelete = !['active','trialing','past_due'].includes(planStatus);

  async function handleDelete() {
    if (!canDelete) return;
    if (!confirm('Tem certeza que deseja excluir sua conta? Essa ação é irreversível.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(()=>({}));
        alert(b?.error || 'Falha ao excluir');
      } else {
        // redirecionar para logout/home
        window.location.href = '/';
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSubscription() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error || 'Falha ao cancelar');
      alert('Assinatura marcada para não renovar.');
      window.location.reload();
    } catch (e:any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 text-lg font-semibold">Assinatura</h2>
        <p className="text-sm text-gray-600">Status atual: <b>{planStatus}</b></p>
        <div className="mt-3 flex gap-2">
          <button
            className="rounded-xl border px-4 py-2"
            onClick={handleCancelSubscription}
            disabled={loading}
          >
            Cancelar assinatura
          </button>
        </div>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 text-lg font-semibold text-red-600">Excluir conta</h2>
        {!canDelete && (
          <div className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
            Você possui uma assinatura ativa. Cancele primeiro para liberar a exclusão da conta.
          </div>
        )}
        <button
          className={`mt-3 rounded-xl px-4 py-2 text-white ${canDelete? 'bg-red-600' : 'bg-red-300 cursor-not-allowed'}`}
          onClick={handleDelete}
          disabled={!canDelete || loading}
        >
          Excluir minha conta
        </button>
      </section>
    </div>
  );
}

