"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * O shell estratégico é mobile-only por design (`fixed inset-0`, tab bar
 * `lg:hidden`). No desktop ele renderiza quebrado (sidebar sobre o conteúdo, sem
 * navegação por abas). Como o equivalente desktop do mapa agora vive nos boards
 * pinados da central, mandamos o usuário de desktop para a home (`/`) em vez de
 * deixá-lo preso nesta tela. Mobile (<1024px) não é afetado.
 */
export default function DesktopRedirectGuard() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      router.replace("/");
    }
  }, [router]);
  return null;
}
