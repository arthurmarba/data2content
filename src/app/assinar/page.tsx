'use client';
import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PublicSubscribePage() {
  const searchParams = useSearchParams();
  const agencyCode = searchParams.get('codigo_agencia');
  const [email, setEmail] = useState('');

  const handleSubscribe = async () => {
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
      <input type="email" placeholder="Seu email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-2" />
      <button className="px-4 py-2 bg-brand-pink text-white rounded" onClick={handleSubscribe}>Assinar</button>
    </div>
  );
}
