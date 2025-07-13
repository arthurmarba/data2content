'use client';
import React, { useEffect, useState } from 'react';
import AgencyAuthGuard from '../components/AgencyAuthGuard';
import CreatorTable from '@/app/admin/creator-dashboard/CreatorTable';

export default function AgencyDashboardPage() {
  const [inviteCode, setInviteCode] = useState<string>('');
  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agency/invite-code').then(res => res.json()).then(data => {
      if (data.inviteCode) setInviteCode(data.inviteCode);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchCreators = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/agency/dashboard/creators');
        if (!response.ok) {
          throw new Error('Falha ao buscar os dados dos criadores.');
        }
        const data = await response.json();
        setCreators(data.creators);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCreators();
  }, []);

  const inviteLink = inviteCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/assinar?codigo_agencia=${inviteCode}` : '';

  const copy = () => {
    if (inviteLink) navigator.clipboard.writeText(inviteLink);
  };

  return (
    <AgencyAuthGuard>
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard da Agência</h1>
          {inviteCode && (
            <div className="bg-white p-4 rounded shadow inline-flex items-center gap-2 mt-2">
              <span className="text-sm break-all">{inviteLink}</span>
              <button className="px-2 py-1 text-sm bg-brand-pink text-white rounded" onClick={copy}>Copiar</button>
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Visão Geral dos Seus Criadores</h2>

          {isLoading && <p>Carregando criadores...</p>}

          {error && <p className="text-red-500">{error}</p>}

          {!isLoading && !error && creators.length > 0 && (
            <CreatorTable data={creators} />
          )}

          {!isLoading && !error && creators.length === 0 && (
            <div className="text-center py-10 bg-gray-50 rounded-lg">
              <p>Nenhum criador encontrado para esta agência.</p>
              <p className="text-sm text-gray-600">Use o link de convite acima para começar a adicionar seus talentos!</p>
            </div>
          )}
        </div>
      </div>
    </AgencyAuthGuard>
  );
}
