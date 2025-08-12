"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<
    "checking" | "succeeded" | "requires_action" | "processing" | "failed"
  >("checking");

  useEffect(() => {
    // Ajuste conforme seu fluxo real (você pode checar algo no backend).
    const ok = params.get("ok");
    setStatus(ok === "1" ? "succeeded" : "succeeded");
  }, [params]);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Pagamento enviado ✅</h1>
      <p>Estamos confirmando sua assinatura. Você já pode retornar ao app.</p>
      <div className="flex gap-2">
        <Link href="/dashboard" className="px-4 py-2 rounded bg-black text-white">
          Ir para o painel
        </Link>
        <Link href="/dashboard/billing" className="px-4 py-2 rounded border">
          Gerenciar assinatura
        </Link>
      </div>
      <p className="sr-only">Status: {status}</p>
    </div>
  );
}
