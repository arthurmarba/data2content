// src/app/billing/success/page.tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function BillingSuccessPage() {
  const sp = useSearchParams();
  const sid = sp.get("session_id");
  const { update } = useSession();
  const router = useRouter();

  // ✅ Atualiza a sessão apenas UMA vez (mesmo em StrictMode) e sem refresh em loop
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onceKey = sid ? `billing-success:${sid}` : "billing-success";
    if (sessionStorage.getItem(onceKey)) return; // já rodou
    sessionStorage.setItem(onceKey, "1");

    (async () => {
      try {
        // Se você confirmar o checkout pelo client, descomente:
        // if (sid) await fetch(`/api/stripe/confirm?session_id=${sid}`, { method: "POST" });

        await update(); // atualiza planStatus/stripe* no token uma única vez
        // Não precisa chamar router.refresh() aqui. Ao navegar, o server já refaz o fetch.
      } catch {
        // ignora erros; não bloqueia a tela
      }
    })();
  // dependemos só do sid para a chave de "uma vez"
  }, [sid, update]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Tudo certo!</h1>
      <p className="text-gray-700">
        Sua assinatura PRO foi ativada com sucesso. Você já tem acesso total a todos os recursos.
      </p>
      <p className="mt-2 text-gray-600">
        Precisa de algo? Você pode ajustar ou cancelar a assinatura a qualquer momento em{" "}
        <span className="font-medium">Configurações &gt; Billing</span>.
      </p>

      {sid && (
        <p className="mt-3 text-xs text-gray-400">
          ID da sessão: <span className="font-mono">{sid}</span>
        </p>
      )}

      <a className="mt-5 inline-block rounded-xl bg-black px-4 py-2 text-white" href="/dashboard/chat">
        Conversar com IA
      </a>
    </div>
  );
}
