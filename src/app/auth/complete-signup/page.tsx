// src/app/auth/complete-signup/page.tsx
// Versão: v3.0 — finaliza o fluxo marcando o usuário como onboarded antes de redirecionar.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import FullPageLoader from "@/app/components/auth/FullPageLoader";

const DESTINATION = "/media-kit";

export default function CompleteSignupPage() {
  const router = useRouter();
  const { update, status } = useSession();
  const ranRef = useRef(false);
  const [message, setMessage] = useState("Finalizando seu acesso...");

  useEffect(() => {
    if (ranRef.current) return;
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    ranRef.current = true;

    const finalize = async () => {
      try {
        const response = await fetch("/api/user/complete-onboarding", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error("[complete-signup] Falha ao completar onboarding:", response.status, errorText);
          setMessage("Não foi possível finalizar seu acesso automaticamente. Redirecionando...");
        }
      } catch (error) {
        console.error("[complete-signup] Erro inesperado ao finalizar onboarding:", error);
        setMessage("Não foi possível finalizar seu acesso automaticamente. Redirecionando...");
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("onboardingCompletedByClient", "1");
      }

      try {
        await update?.({ isNewUserForOnboarding: false });
      } catch (error) {
        console.warn("[complete-signup] Não foi possível atualizar a sessão local:", error);
      }

      router.replace(DESTINATION);
    };

    finalize();
  }, [router, status, update]);

  return <FullPageLoader message={message} />;
}
