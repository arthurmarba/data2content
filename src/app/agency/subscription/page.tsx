'use client';
import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import {
  AGENCY_ANNUAL_MONTHLY_PRICE,
  AGENCY_MONTHLY_PRICE,
} from '@/config/pricing.config';

export default function AgencySubscriptionPage() {
  const { data: session } = useSession();
  const [inviteCode, setInviteCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'annual'>('basic');

  useEffect(() => {
    fetch('/api/agency/invite-code')
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          if (data.inviteCode) setInviteCode(data.inviteCode);
        } else if (res.status === 403) {
          const data = await res.json().catch(() => null);
          toast.error(data?.error || 'Você precisa de um plano ativo para acessar o link de convite.');
        }
      })
      .catch(() => {});
  }, []);

  const planStatus = session?.user?.agencyPlanStatus || 'inactive';
  const planType = session?.user?.agencyPlanType || 'basic';

  const handleSubscribe = async () => {
    setIsLoading(true);
    const res = await fetch('/api/agency/subscription/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: selectedPlan })
    });
    const json = await res.json();
    if (res.ok && json.initPoint) {
      window.location.href = json.initPoint;
    } else {
      toast.error(json.error || 'Não foi possível iniciar a assinatura.');
      setIsLoading(false);
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
      <div className="border rounded-lg p-4 space-y-2 bg-white shadow">
        <p className="text-lg font-semibold">Escolha o plano</p>
        <div className="space-y-1">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="plan"
              value="basic"
              checked={selectedPlan === 'basic'}
              onChange={() => setSelectedPlan('basic')}
            />
            <span>
              Plano Mensal - R$ {AGENCY_MONTHLY_PRICE.toFixed(2).replace('.', ',')}/mês
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="plan"
              value="annual"
              checked={selectedPlan === 'annual'}
              onChange={() => setSelectedPlan('annual')}
            />
            <span>
              Plano Anual - R$ {(AGENCY_ANNUAL_MONTHLY_PRICE * 12).toFixed(2).replace('.', ',')}/ano
            </span>
          </label>
        </div>
        <ul className="list-disc list-inside text-sm text-gray-700">
          <li>Acesso ao dashboard dos criadores vinculados</li>
          <li>Suporte prioritário via WhatsApp</li>
          <li>Desconto de 10% para seus criadores</li>
        </ul>
        <p className="text-sm">Plano atual: <strong>{planType}</strong></p>
        <p className="text-sm">Status atual: <strong>{planStatus}</strong></p>
        {planStatus !== 'active' && (
          <button
            className="px-4 py-2 bg-brand-pink text-white rounded disabled:opacity-50"
            onClick={handleSubscribe}
            disabled={isLoading}
          >
            {isLoading ? 'Aguarde...' : 'Contratar'}
          </button>
        )}
        {planStatus === 'active' && (
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-gray-800 text-white rounded"
              onClick={handleManage}
            >
              Gerenciar Assinatura
            </button>
            <Link
              href="/agency/dashboard"
              className="px-4 py-2 bg-brand-pink text-white rounded"
            >
              Ir para Dashboard
            </Link>
          </div>
        )}
      </div>
      {inviteCode && (
        <div className="text-sm flex items-center gap-2">
          <span>Link de convite:</span>
          <span className="truncate">{`${typeof window !== 'undefined' ? window.location.origin : ''}/assinar?codigo_agencia=${inviteCode}`}</span>
          <button onClick={() => navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/assinar?codigo_agencia=${inviteCode}`).then(() => toast.success('Copiado!'))} className="text-gray-500 hover:text-brand-pink text-xs border px-2 py-1 rounded">Copiar link</button>
        </div>
      )}
    </div>
  );
}
