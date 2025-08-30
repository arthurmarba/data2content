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
  const [isAnnual, setIsAnnual] = useState(true);

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
      router.replace('/dashboard/chat');
    }
  }, [status, router]);

  const prices = {
    monthly: agencyName ? AGENCY_GUEST_MONTHLY_PRICE : MONTHLY_PRICE,
    annualMonthly: agencyName ? AGENCY_GUEST_ANNUAL_MONTHLY_PRICE : ANNUAL_MONTHLY_PRICE,
  };

  const price = isAnnual ? prices.annualMonthly : prices.monthly;
  const billingInfo = isAnnual
    ? `Cobrado R$${(prices.annualMonthly * 12).toFixed(2).replace('.', ',')} por ano`
    : 'Cobrado mensalmente';
  const planName = isAnnual ? 'Plano Anual' : 'Plano Mensal';

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div
        id="subscription-component"
        className="w-full max-w-sm mx-auto p-8 bg-white rounded-2xl shadow-lg"
      >
        <style jsx>{`
          :root {
            --color-primary: #EC4899;
            --color-primary-dark: #DB2777;
          }
          .bg-primary { background-color: var(--color-primary); }
          .bg-primary-dark { background-color: var(--color-primary-dark); }
          .text-primary { color: var(--color-primary); }
          .border-primary { border-color: var(--color-primary); }
          .toggle-btn { transition: all 0.3s ease-in-out; }
        `}</style>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Escolha seu plano</h1>
          <p className="text-gray-500 mt-1">Acesso ilimitado a todos os recursos.</p>
        </div>

        {agencyName ? (
          <div className="bg-green-100 text-green-800 p-2 rounded text-sm mb-6">
            <p>Bem-vindo como convidado da {agencyName}!</p>
            <p>
              Como convidado, o plano mensal sai por{' '}
              <strong>
                R${AGENCY_GUEST_MONTHLY_PRICE.toFixed(2).replace('.', ',')}
              </strong>{' '}
              e o plano anual por{' '}
              <strong>
                R${(AGENCY_GUEST_ANNUAL_MONTHLY_PRICE * 12)
                  .toFixed(2)
                  .replace('.', ',')}
              </strong>{' '}
              pagos uma vez ao ano.
            </p>
          </div>
        ) : null}

        <div className="flex justify-center bg-gray-100 p-1 rounded-full mb-8">
          <button
            id="monthly-btn"
            className={`toggle-btn w-1/2 px-4 py-2 rounded-full text-sm font-semibold ${
              !isAnnual ? 'text-white bg-primary' : 'text-gray-600'
            }`}
            onClick={() => setIsAnnual(false)}
          >
            Mensal
          </button>
          <button
            id="annual-btn"
            className={`toggle-btn w-1/2 px-4 py-2 rounded-full text-sm font-semibold ${
              isAnnual ? 'text-white bg-primary' : 'text-gray-600'
            }`}
            onClick={() => setIsAnnual(true)}
          >
            Anual{' '}
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full ml-1">
              Economize 40%
            </span>
          </button>
        </div>

        <div className="text-center mb-8">
          <p id="plan-name" className="text-lg font-semibold text-gray-800 mb-2">
            {planName}
          </p>
          <div className="flex justify-center items-end">
            <span id="price-display" className="text-5xl font-extrabold text-gray-900">
              R${price.toFixed(2).replace('.', ',')}
            </span>
            <span id="period-display" className="text-lg text-gray-500 font-medium ml-1">
              /mês
            </span>
          </div>
          <p id="billing-info" className="text-sm text-gray-500 mt-2">
            {billingInfo}
          </p>
        </div>

        {status === 'authenticated' ? (
          <p className="text-center">Redirecionando para Conversar com IA...</p>
        ) : (
          <button
            className="w-full bg-primary text-white py-3 px-4 rounded-xl text-lg font-semibold hover:bg-primary-dark transition-colors duration-300 shadow-md hover:shadow-lg"
            onClick={() => signIn(undefined, { callbackUrl: window.location.href })}
          >
            Assinar agora
          </button>
        )}

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Pagamento seguro via Mercado Pago. Sem fidelidade.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Renovação automática.{' '}
            <span className="font-semibold text-primary">Cancele quando quiser.</span>
          </p>
        </div>

        {alert === 'convite_invalido' && (
          <div className="text-center mt-4 bg-yellow-100 text-yellow-800 p-2 rounded">
            Convite inválido ou agência inativa. Confira nossos planos.
          </div>
        )}
      </div>
    </div>
  );
}
