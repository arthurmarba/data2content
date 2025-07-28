'use client';
import React, { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

export default function PublicSubscribePage() {
  const searchParams = useSearchParams();
  const agencyCode = searchParams.get('codigo_agencia');
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);


  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      {agencyCode && <div className="bg-green-100 text-green-800 p-2 rounded">Você foi convidado por uma agência! Desconto aplicado.</div>}
      {status === 'authenticated' ? (
        <p>Redirecionando para seu dashboard...</p>
      ) : (
        <button className="px-4 py-2 bg-brand-pink text-white rounded" onClick={() => signIn(undefined, { callbackUrl: window.location.href })}>Entrar para Assinar</button>
      )}
    </div>
  );
}
