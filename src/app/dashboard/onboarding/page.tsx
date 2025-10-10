// src/app/dashboard/onboarding/page.tsx
"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import OnboardingStepper, { StepItem } from "@/components/onboarding/OnboardingStepper";
// import { track } from "@/lib/track"; // opcional: se quiser telemetria do clique

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [loading, setLoading] = useState(false);

  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);

  const steps = useMemo<StepItem[]>(() => {
    return [
      {
        key: "connect-instagram",
        title: "Conectar Instagram",
        description: "Autorize no Facebook (somente leitura).",
        state: instagramConnected ? "completed" : "current",
      },
      {
        key: "sync",
        title: "Sincronizar",
        description: "Carregamos suas métricas públicas.",
        state: instagramConnected ? "completed" : "pending",
      },
      {
        key: "done",
        title: "Pronto",
        description: "Entre na Comunidade.",
        state: instagramConnected ? "current" : "pending",
      },
    ];
  }, [instagramConnected]);

  const goToPreConnect = useCallback(() => router.push("/dashboard/instagram/connect"), [router]);

  // Novo handler: conclui onboarding + atualiza sessão + vai para o Media Kit
  const enterCommunity = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // track?.("onboarding_join_click"); // opcional

      // 1) Marca onboarding como concluído no servidor (ignora erro para não travar UX)
      await fetch("/api/user/complete-onboarding", { method: "POST" }).catch(() => {});

      // 2) Força reidratação da sessão (se falhar, seguimos)
      await update?.({ isNewUserForOnboarding: false }).catch(() => {});

      // 3) Destino interno estável
      // Usamos assign para funcionar igual com ou sem rota externa no futuro
      window.location.assign("/dashboard/media-kit");
    } finally {
      setLoading(false);
    }
  }, [loading, update]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Começar</h1>
      <p className="text-gray-600 mt-2">
        Siga estes passos para configurar seu ambiente e conectar seu Instagram com segurança.
      </p>

      <div className="mt-6">
        <OnboardingStepper steps={steps} />
      </div>

      {/* Mini callout curto */}
      <div className="mt-4 p-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
        Somente leitura • Sem publicações • Revogável a qualquer momento.{" "}
        <a className="underline text-blue-700 hover:text-blue-800" href="/dashboard/instagram/faq">
          Saiba mais
        </a>
      </div>

      <div className="mt-6 p-4 rounded-lg border border-gray-200 bg-white">
        {!instagramConnected ? (
          <div>
            <h2 className="text-lg font-medium text-gray-900">Conectar Instagram</h2>
            <p className="text-sm text-gray-600 mt-1">Autorize no Facebook em poucos passos.</p>
            <button
              onClick={goToPreConnect}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              type="button"
            >
              Continuar
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-medium text-gray-900">Tudo certo com a conexão!</h2>
            <p className="text-sm text-gray-600 mt-1">
              Podemos continuar para o seu Mídia Kit com dados frescos.
            </p>
            <button
              onClick={enterCommunity}
              disabled={loading}
              aria-busy={loading}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              type="button"
            >
              {loading ? "Abrindo…" : "Entrar na Comunidade"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
