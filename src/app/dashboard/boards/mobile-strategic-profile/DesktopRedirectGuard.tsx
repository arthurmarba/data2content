"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";

/**
 * Compatibilidade para links antigos do Perfil mobile. No desktop, mantém o
 * contexto da ação (checkout, Instagram ou comunidade) e abre a superfície
 * responsiva canônica em vez de descartar o usuário na Home.
 */
export default function DesktopRedirectGuard() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      router.replace(`${CREATOR_PROFILE_ROUTE}${window.location.search}${window.location.hash}`);
    }
  }, [router]);
  return null;
}
