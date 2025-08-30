// src/app/dashboard/billing/thanks/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaCheckCircle } from 'react-icons/fa';

export default function SubscriptionThanksPage() {
  const router = useRouter();

  // Redireciona o usuário para o chat após alguns segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/dashboard/chat');
    }, 5000); // 5 segundos

    return () => clearTimeout(timer); // Limpa o timer se o componente for desmontado
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <FaCheckCircle className="text-green-500 text-6xl mb-4" />
      <h1 className="text-3xl font-bold mb-2">Pagamento Confirmado!</h1>
      <p className="text-gray-600 max-w-md mb-6">
        Sua assinatura foi processada com sucesso. Estamos ativando seu plano e você será redirecionado em breve.
      </p>
      <button 
        onClick={() => router.replace('/dashboard/chat')}
        className="px-6 py-2 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
      >
        Conversar com IA
      </button>
    </div>
  );
}
