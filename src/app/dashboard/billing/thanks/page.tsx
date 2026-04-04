"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SubscriptionThanksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    router.replace(query ? `/billing/success?${query}` : "/billing/success");
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-6 py-12 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Redirecionando seu acesso…</h1>
        <p className="mt-2 text-sm text-slate-600">
          Estamos concluindo a confirmação da assinatura e restaurando sua jornada.
        </p>
      </div>
    </div>
  );
}
