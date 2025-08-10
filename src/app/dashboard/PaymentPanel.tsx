"use client";

interface PaymentPanelProps {
  // Props retained for compatibility; not currently used
  user?: unknown;
}

export default function PaymentPanel({ user: _user }: PaymentPanelProps) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg sm:text-xl font-bold text-center text-brand-dark mb-3">
          Plano Data2Content
        </h3>
        <a
          href="/dashboard/billing"
          className="w-full inline-flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl font-semibold"
        >
          Assinar agora
        </a>
        <p className="mt-2 text-center text-xs text-gray-500">
          Pagamento seguro via Stripe. Sem fidelidade — cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
