// src/app/auth/complete-signup/page.tsx
// Versão: v1.3.0
// - Evita loops pós-checkout (redirect para /dashboard apenas 1x)
// - Atualiza a sessão uma única vez (guard contra Strict Mode)
// - Usa router.replace em vez de push para não adicionar histórico
// - Mantém o fluxo de aceitação de termos (onboarding)

"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import TermsAcceptanceStep from "@/app/components/auth/TermsAcceptanceStep";
import FullPageLoader from "@/app/components/auth/FullPageLoader";

export default function CompleteSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update: updateSession } = useSession();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Evita reentradas do efeito no Strict Mode / updates rápidos do NextAuth
  const ranOnceRef = useRef(false);

  // Orquestra o fluxo de navegação/refresh apenas uma vez
  useEffect(() => {
    if (status === "loading" || ranOnceRef.current) return;

    ranOnceRef.current = true;

    (async () => {
      try {
        if (status === "unauthenticated") {
          router.replace("/login");
          return;
        }

        // Autenticado: trate retorno de checkout imediatamente
        const checkout = searchParams.get("checkout");
        if (status === "authenticated" && checkout) {
          // Ex.: ?checkout=success | ?checkout=cancel
          try {
            await updateSession?.();
          } catch {
            // ignore falha de refresh; seguimos com o redirect
          }
          router.replace(`/dashboard/chat?checkout=${checkout}`);
          return;
        }

        // Se já completou onboarding, envie ao dashboard
        if (status === "authenticated" && session?.user?.isNewUserForOnboarding === false) {
          router.replace("/dashboard/chat");
          return;
        }

        // Caso contrário, permanecemos na página para aceitar termos
      } catch {
        router.replace("/dashboard/chat");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]); // searchParams não entra para não re-disparar

  const handleTermsAcceptedAndContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/user/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Erro ${res.status} ao completar o onboarding.`);
      }

      try {
        await updateSession?.(); // garantir que a sessão traga isNewUserForOnboarding=false
      } catch {
        /* se falhar, seguimos para o dashboard mesmo assim */
      }

      router.replace("/dashboard/chat");
    } catch (err: any) {
      setSubmitError(err?.message || "Ocorreu um erro ao processar sua solicitação.");
      setIsSubmitting(false);
    }
  };

  // Loading geral (inclui submissão)
  if (status === "loading" || isSubmitting) {
    return <FullPageLoader message={isSubmitting ? "A processar sua aceitação..." : "A verificar o seu estado..."} />;
  }

  // Exibe o passo de termos quando necessário
  if (status === "authenticated" && session?.user?.isNewUserForOnboarding === true) {
    return (
      <>
        <TermsAcceptanceStep userName={session?.user?.name} onAcceptAndContinue={handleTermsAcceptedAndContinue} />
        {submitError && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-red-600 text-white text-center z-50">
            <p>Erro: {submitError}</p>
            <button onClick={() => setSubmitError(null)} className="ml-2 underline">
              Fechar
            </button>
          </div>
        )}
      </>
    );
  }

  // Fallback enquanto um redirect está em curso
  return <FullPageLoader message="A finalizar ou a redirecionar..." />;
}
