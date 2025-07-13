'use client';
import React, { useEffect, useState } from 'react';
import AgencyAuthGuard from '../components/AgencyAuthGuard';

export default function AgencyDashboardPage() {
  const [inviteCode, setInviteCode] = useState<string>('');

  useEffect(() => {
    fetch('/api/agency/invite-code').then(res => res.json()).then(data => {
      if (data.inviteCode) setInviteCode(data.inviteCode);
    }).catch(() => {});
  }, []);

  const inviteLink = inviteCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/assinar?codigo_agencia=${inviteCode}` : '';

  const copy = () => {
    if (inviteLink) navigator.clipboard.writeText(inviteLink);
  };

  return (
    <AgencyAuthGuard>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Dashboard da Agência</h1>
        {inviteCode && (
          <div className="bg-white p-4 rounded shadow inline-flex items-center gap-2">
            <span className="text-sm">{inviteLink}</span>
            <button className="px-2 py-1 text-sm bg-brand-pink text-white rounded" onClick={copy}>Copiar</button>
          </div>
        )}
      </div>
    </AgencyAuthGuard>
  );
}
