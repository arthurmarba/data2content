// src/app/auth/complete-signup/page.tsx
// Versão: v1.3.0 (Corrigido para redirecionar para Mídia Kit)

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

  const ranOnceRef = useRef(false);

  useEffect(() => {
    if (status === "loading" || ranOnceRef.current) return;

    ranOnceRef.current = true;

    (async () => {
      try {
        if (status === "unauthenticated") {
          router.replace("/login");
          return;
        }

        const checkout = searchParams.get("checkout");
        if (status === "authenticated" && checkout) {
          try {
            await updateSession?.();
          } catch {
            // ignore
          }
          // ALTERADO: Redireciona para o Mídia Kit após o checkout
          router.replace(`/dashboard/media-kit?checkout=${checkout}`); // <-- ALTERADO
          return;
        }

        if (status === "authenticated" && session?.user?.isNewUserForOnboarding === false) {
          // ALTERADO: Redireciona usuários existentes para o Mídia Kit
          router.replace("/dashboard/media-kit"); // <-- ALTERADO
          return;
        }

      } catch {
        // ALTERADO: Redireciona para o Mídia Kit como fallback em caso de erro
        router.replace("/dashboard/media-kit"); // <-- ALTERADO
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

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
        await updateSession?.();
      } catch {
        /* se falhar, seguimos mesmo assim */
      }

      // ALTERADO: Redireciona para o Mídia Kit após aceitar os termos
      router.replace("/dashboard/media-kit"); // <-- ALTERADO
    } catch (err: any) {
      setSubmitError(err?.message || "Ocorreu um erro ao processar sua solicitação.");
      setIsSubmitting(false);
    }
  };

  if (status === "loading" || isSubmitting) {
    return <FullPageLoader message={isSubmitting ? "A processar sua aceitação..." : "A verificar o seu estado..."} />;
  }

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

  return <FullPageLoader message="A finalizar ou a redirecionar..." />;
}