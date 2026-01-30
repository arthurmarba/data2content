// src/app/billing/success/page.tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { track } from "@/lib/track";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

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

        const updatedSession = await update(); // atualiza planStatus/stripe* no token uma única vez
        const user = updatedSession?.user as { id?: string | null; planInterval?: string | null } | null | undefined;
        let resolvedContext: string | null = null;
        const stored = sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (typeof data?.context === "string") {
              resolvedContext = data.context;
            }
            const returnTo =
              typeof data?.returnTo === "string" && data.returnTo.startsWith("/")
                ? data.returnTo
                : null;
            sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
            if (returnTo) {
              const current = `${window.location.pathname}${window.location.search || ""}`;
              if (current !== returnTo) {
                router.push(returnTo);
              }
            }
          } catch {
            sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
          }
        }

        if (user?.id) {
          const interval = user.planInterval === "year" ? "anual" : "mensal";
          track("paywall_subscribed", {
            creator_id: user.id,
            plan: interval,
            context: resolvedContext ?? "default",
          });
          track("subscription_activated", {
            creator_id: user.id,
            plan: interval,
            currency: null,
            value: null,
          });
        }
        // Não precisa chamar router.refresh() aqui. Ao navegar, o server já refaz o fetch.
      } catch {
        // ignora erros; não bloqueia a tela
      }
    })();
  // dependemos só do sid para a chave de "uma vez"
  }, [sid, update, router]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Tudo certo!</h1>
      <p className="text-gray-700">
        Sua assinatura do Plano Pro foi ativada com sucesso. Você já tem acesso total a todos os
        recursos.
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
