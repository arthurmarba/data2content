'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

export default function PublicSubscribePage() {
  const searchParams = useSearchParams();
  const agencyCode = searchParams.get('codigo_agencia');
  const { status } = useSession();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [invalidInvite, setInvalidInvite] = useState(false);

  useEffect(() => {
    if (agencyCode) {
      fetch(`/api/agency/info/${agencyCode}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setAgencyName(data.name);
          } else {
            setInvalidInvite(true);
          }
        })
        .catch(() => setInvalidInvite(true));
    }
  }, [agencyCode]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);


  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      {agencyName && (
        <div className="bg-green-100 text-green-800 p-2 rounded">
          Boas-vindas! Como convidado da {agencyName}, você tem acesso a planos exclusivos.
        </div>
      )}
      {invalidInvite && (
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
