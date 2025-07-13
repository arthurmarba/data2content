'use client';
import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function AgencySubscriptionPage() {
  const { data: session } = useSession();
  const [inviteCode, setInviteCode] = useState<string>('');

  useEffect(() => {
    fetch('/api/agency/invite-code').then(res => res.json()).then(data => {
      if (data.inviteCode) setInviteCode(data.inviteCode);
    }).catch(() => {});
  }, []);

  const planStatus = session?.user?.agencyPlanStatus || 'inactive';

  const handleSubscribe = async () => {
    const res = await fetch('/api/agency/subscription/create-checkout', { method: 'POST', body: JSON.stringify({ planId: 'basic' }) });
    if (res.ok) {
      const json = await res.json();
      window.location.href = json.checkoutUrl;
    }
  };

  const handleManage = async () => {
    const res = await fetch('/api/agency/subscription/manage-portal', { method: 'POST' });
    if (res.ok) {
      const json = await res.json();
      window.location.href = json.portalUrl;
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Assinatura da Agência</h1>
      <p>Status atual: <strong>{planStatus}</strong></p>
      {planStatus !== 'active' && (
        <button className="px-4 py-2 bg-brand-pink text-white rounded" onClick={handleSubscribe}>Contratar</button>
      )}
      {planStatus === 'active' && (
        <button className="px-4 py-2 bg-gray-800 text-white rounded" onClick={handleManage}>Gerenciar Assinatura</button>
      )}
      {inviteCode && (
        <p className="mt-4 text-sm">Link de convite: {`${typeof window !== 'undefined' ? window.location.origin : ''}/assinar?codigo_agencia=${inviteCode}`}</p>
      )}
    </div>
  );
}
