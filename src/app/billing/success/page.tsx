// src/app/billing/success/page.tsx
export default function BillingSuccessPage() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Pagamento confirmado</h1>
      <p className="text-gray-600">Obrigado! Sua assinatura está ativa.</p>
      <a className="mt-4 inline-block rounded-xl bg-black px-4 py-2 text-white" href="/app">
        Ir para o app
      </a>
    </div>
  );
}
