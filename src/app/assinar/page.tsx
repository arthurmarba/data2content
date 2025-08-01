'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import {
  MONTHLY_PRICE,
  ANNUAL_MONTHLY_PRICE,
  AGENCY_GUEST_MONTHLY_PRICE,
  AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
} from '@/config/pricing.config';

export default function PublicSubscribePage() {
  const searchParams = useSearchParams();
  const agencyCode = searchParams.get('codigo_agencia');
  const alert = searchParams.get('alert');
  const { status } = useSession();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState<string | null>(null);

  useEffect(() => {
    if (agencyCode) {
      fetch(`/api/agency/info/${agencyCode}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setAgencyName(data.name);
          } else {
            router.replace('/assinar?alert=convite_invalido');
          }
        })
        .catch(() => router.replace('/assinar?alert=convite_invalido'));
    }
  }, [agencyCode, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      {agencyName ? (
        <div className="bg-green-100 text-green-800 p-2 rounded space-y-1">
          <p>Bem-vindo como convidado da {agencyName}!</p>
          <p>
            Como convidado, o plano mensal sai por{' '}
            <strong>
              R${AGENCY_GUEST_MONTHLY_PRICE.toFixed(2).replace('.', ',')}
            </strong>{' '}
            e o plano anual por{' '}
            <strong>
              R${(AGENCY_GUEST_ANNUAL_MONTHLY_PRICE * 12).toFixed(2).replace('.', ',')}
            </strong>{' '}
            pagos uma vez ao ano.
          </p>
        </div>
      ) : (
        <div className="bg-gray-100 text-gray-800 p-2 rounded">
          <p className="mb-1">Conheça nossos planos:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Plano Mensal - R${MONTHLY_PRICE.toFixed(2).replace('.', ',')}/mês
            </li>
            <li>
              Plano Anual - R${(ANNUAL_MONTHLY_PRICE * 12).toFixed(2).replace('.', ',')}/ano
            </li>
          </ul>
        </div>
      )}
      {alert === 'convite_invalido' && (
        <div className="bg-yellow-100 text-yellow-800 p-2 rounded">
          Convite inválido ou agência inativa. Confira nossos planos.
        </div>
      )}
      {status === 'authenticated' ? (
        <p>Redirecionando para seu dashboard...</p>
      ) : (
        <button
          className="px-4 py-2 bg-brand-pink text-white rounded"
          onClick={() => signIn(undefined, { callbackUrl: window.location.href })}
        >
          Entrar para Assinar
        </button>
      )}
    </div>
  );
}
