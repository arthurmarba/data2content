'use client';
import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

export default function PublicSubscribePage() {
  const searchParams = useSearchParams();
  const agencyCode = searchParams.get('codigo_agencia');
  const { data: session, status } = useSession();

  const handleSubscribe = async () => {
    if (!session) return;
    const res = await fetch('/api/plan/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planType: 'monthly', agencyInviteCode: agencyCode }),
    });
    if (res.ok) {
      const json = await res.json();
      window.location.href = json.initPoint;
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      {agencyCode && <div className="bg-green-100 text-green-800 p-2 rounded">Você foi convidado por uma agência! Desconto aplicado.</div>}
      {status === 'authenticated' ? (
        <button className="px-4 py-2 bg-brand-pink text-white rounded" onClick={handleSubscribe}>Assinar</button>
      ) : (
        <button className="px-4 py-2 bg-brand-pink text-white rounded" onClick={() => signIn(undefined, { callbackUrl: window.location.href })}>Entrar para Assinar</button>
      )}
    </div>
  );
}
