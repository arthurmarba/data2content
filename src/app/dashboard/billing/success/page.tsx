'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const params = useSearchParams();
  const sid = params.get('sid');

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">Pagamento iniciado!</h1>
      <p className="text-sm text-gray-700">
        Estamos confirmando seu pagamento. Seu plano será ativado assim que o Stripe confirmar
        (o webhook já cuida disso automaticamente).
      </p>
      {sid && (
        <p className="text-xs text-gray-500 mt-2">
          Assinatura: <code>{sid}</code>
        </p>
      )}
      <Link className="inline-block mt-4 underline" href="/dashboard">
        Voltar ao painel
      </Link>
    </div>
  );
}
